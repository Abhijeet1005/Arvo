// The autopilot's data: settings, markets, prospects and the rules that move a
// prospect from "found" to "sent". Pure module (no network, no server imports),
// shared by the scheduler, the API routes, the dashboard and the tests.
//
//   prospect = {
//     id, marketId, name, domain, website, city, why, linkedin,
//     stage, createdAt, updatedAt,
//     fit { score, reason }, industry, contact { email, phone },
//     profile,                      the website read, kept until the demo exists
//     demoId, linkToken, demoUrl,
//     draft { subject, body, followups[{ body }], linkedin },
//     approvedAt, linkedinSentAt,
//     emails [{ kind, to, at, messageId, sandbox }],
//     unsubToken, reply { at, label, summary }, engagedAt,
//     error { step, message, at }, attempts,
//   }

// ------------------------------------------------------------ stages

export const STAGES = [
  { id: 'found', label: 'Found' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'demo_ready', label: 'Demo ready' },
  { id: 'drafted', label: 'Awaiting approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'sent', label: 'Emailed' },
  { id: 'followup_1', label: 'Follow-up 1' },
  { id: 'followup_2', label: 'Follow-up 2' },
  { id: 'replied', label: 'Replied' },
  { id: 'engaged', label: 'Tried the demo' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
  { id: 'bounced', label: 'Bounced' },
  { id: 'rejected', label: 'Not a fit' },
  { id: 'failed', label: 'Failed' },
  { id: 'closed', label: 'Closed' },
];
export const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id;

// Stages the autopilot never moves a prospect out of on its own.
export const FINAL_STAGES = new Set(['replied', 'engaged', 'unsubscribed', 'bounced', 'rejected', 'failed', 'closed']);
// Stages where the next email in the sequence may still go out.
export const SEQUENCE_STAGES = ['sent', 'followup_1', 'followup_2'];
// A step that keeps failing stops being retried after this many attempts.
export const MAX_ATTEMPTS = 3;

export const REPLY_LABELS = ['interested', 'not_now', 'unsubscribe', 'out_of_office', 'other'];

// ------------------------------------------------------------ settings

export const MODES = ['paused', 'approve', 'auto'];

export const DEFAULT_PRODUCT =
  'Arvo builds AI voice agents for businesses. The agent picks up phone and website calls 24/7 (in English, or Hinglish for Indian businesses), ' +
  'answers questions from the business’s own information, captures the caller’s details and books the next step, then ' +
  'sends the team a summary. Setup takes days, not months, and costs far less than a call-centre seat.';

export const DEFAULT_SETTINGS = {
  // Nothing runs until the operator picks a mode on the dashboard.
  mode: 'paused',
  // Every email goes to sandboxTo instead of the prospect until this is off.
  sandbox: true,
  sandboxTo: '',
  caps: { researchRuns: 3, qualify: 30, demos: 10, emails: 40 },
  // New sending domains start low and ramp up, or mailbox providers treat them as spam.
  warmup: { start: 10, step: 5 },
  spendUsd: 5,
  minFit: 60,
  // Send window in each recipient's local time (their market's time zone).
  // Days: 0 = Sunday.
  window: { days: [1, 2, 3, 4, 5], start: 10, end: 18 },
  followupDays: [3, 7],
  sender: { name: '', company: 'Arvo', title: '', address: '', replyTo: '' },
  product: DEFAULT_PRODUCT,
  // Where demo and unsubscribe links point. Filled in from the dashboard's own
  // address the first time it is opened.
  publicUrl: '',
};

// https://host, or http://localhost for trying it out. No path.
export function cleanPublicUrl(v) {
  const s = String(v ?? '').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(s) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(s) ? s : '';
}

const LIMITS = {
  researchRuns: [0, 20],
  qualify: [0, 200],
  demos: [0, 50],
  emails: [0, 300],
};

const int = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const text = (v, max) => String(v ?? '').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').trim().slice(0, max);
const oneLine = (v, max) => text(v, max).replace(/\s+/g, ' ');
const EMAIL_RE = /^[^\s@,;:<>()"[\]\\]+@[^\s@,;:<>()"[\]\\]+\.[^\s@,;:<>()"[\]\\]+$/;
export const isEmail = (v) => EMAIL_RE.test(String(v ?? '').trim()) && String(v).length <= 120;

// Merge untrusted input over the current settings (or the defaults).
export function sanitiseSettings(input = {}, base = DEFAULT_SETTINGS) {
  const b = { ...DEFAULT_SETTINGS, ...base };
  const has = (k) => input[k] !== undefined;
  const out = {
    ...b,
    caps: { ...DEFAULT_SETTINGS.caps, ...b.caps },
    warmup: { ...DEFAULT_SETTINGS.warmup, ...b.warmup },
    window: { ...DEFAULT_SETTINGS.window, ...b.window },
    sender: { ...DEFAULT_SETTINGS.sender, ...b.sender },
  };
  if (has('mode') && MODES.includes(input.mode)) out.mode = input.mode;
  if (has('sandbox')) out.sandbox = input.sandbox !== false;
  if (has('sandboxTo')) out.sandboxTo = isEmail(input.sandboxTo) ? String(input.sandboxTo).trim().toLowerCase() : '';
  if (input.caps) {
    for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
      if (input.caps[k] !== undefined) out.caps[k] = int(input.caps[k], lo, hi, out.caps[k]);
    }
  }
  if (input.warmup) {
    if (input.warmup.start !== undefined) out.warmup.start = int(input.warmup.start, 1, 300, out.warmup.start);
    if (input.warmup.step !== undefined) out.warmup.step = int(input.warmup.step, 0, 100, out.warmup.step);
  }
  if (has('spendUsd')) {
    const n = Number(input.spendUsd);
    if (Number.isFinite(n)) out.spendUsd = Math.min(200, Math.max(0, Math.round(n * 100) / 100));
  }
  if (has('minFit')) out.minFit = int(input.minFit, 0, 100, out.minFit);
  if (input.window) {
    const w = input.window;
    if (Array.isArray(w.days)) out.window.days = [...new Set(w.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (w.start !== undefined) out.window.start = int(w.start, 0, 23, out.window.start);
    if (w.end !== undefined) out.window.end = int(w.end, 1, 24, out.window.end);
    if (out.window.end <= out.window.start) out.window.end = Math.min(24, out.window.start + 1);
  }
  if (Array.isArray(input.followupDays)) {
    const days = input.followupDays.map((d) => int(d, 1, 60, 0)).filter(Boolean).slice(0, 2);
    out.followupDays = days.sort((a, b) => a - b);
  }
  if (input.sender) {
    const s = input.sender;
    if (s.name !== undefined) out.sender.name = oneLine(s.name, 60);
    if (s.company !== undefined) out.sender.company = oneLine(s.company, 60);
    if (s.title !== undefined) out.sender.title = oneLine(s.title, 60);
    if (s.address !== undefined) out.sender.address = oneLine(s.address, 200);
    if (s.replyTo !== undefined) out.sender.replyTo = isEmail(s.replyTo) ? String(s.replyTo).trim().toLowerCase() : '';
  }
  if (has('product')) out.product = text(input.product, 1200) || DEFAULT_PRODUCT;
  if (has('publicUrl')) out.publicUrl = cleanPublicUrl(input.publicUrl);
  return out;
}

// What still has to be filled in before email can go out, as display lines.
export function sendingGaps(settings, { smtp } = {}) {
  const gaps = [];
  if (!smtp) gaps.push('Set ARVO_OUTREACH_SMTP_URL on the server (the outreach mailbox).');
  if (!settings.publicUrl) gaps.push('Open this dashboard from its public address once, so links point there.');
  if (!settings.sender.name) gaps.push('Add the sender name.');
  if (settings.sandbox && !settings.sandboxTo) gaps.push('Add the address that sandbox emails go to.');
  return gaps;
}

// ------------------------------------------------------------ markets

// Industry presets a demo can use (lib/demos/templates.js INDUSTRIES).
export const DEMO_INDUSTRIES = ['generic', 'homeservices', 'realestate'];

// Countries the autopilot may email, with what their cold-email rules ask for.
// Countries that need prior consent even between businesses (Canada, Germany
// and most of the EU) are deliberately absent, so a market can't target them.
//   tz            default time zone (a market can pick another, e.g. US West)
//   english       how emails to it are spelt and phrased
//   needsAddress  the law asks for a postal address in every email (US: CAN-SPAM)
//   rule          an extra condition a prospect must meet, checked when qualifying
export const COUNTRIES = {
  IN: { name: 'India', tz: 'Asia/Kolkata', english: 'Indian English' },
  GB: {
    name: 'United Kingdom',
    tz: 'Europe/London',
    english: 'British English',
    rule: 'It must be a limited company (Ltd, PLC or LLP): UK rules only allow cold email to companies, not to sole traders or ordinary partnerships.',
  },
  AU: {
    name: 'Australia',
    tz: 'Australia/Sydney',
    english: 'Australian English',
    rule: 'Its website must publish a business email address and must not say it does not want marketing or sales emails.',
  },
  SG: { name: 'Singapore', tz: 'Asia/Singapore', english: 'British English' },
  US: { name: 'United States', tz: 'America/Chicago', english: 'American English', needsAddress: true },
};
export const countryOf = (m) => COUNTRIES[m?.country] || COUNTRIES.IN;

// Why a market can't be emailed right now, or '' when it can.
export function marketBlock(market, settings) {
  const c = countryOf(market);
  if (c.needsAddress && !settings.sender.address) return `Emailing ${c.name} needs a postal address in Settings (required by law there).`;
  return '';
}

const validTz = (tz) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// The markets a fresh install starts with: India first, then three countries
// in small test batches. `key` gives each a stable id, so the ones added to an
// existing install are the same on every read until they're saved.
export const DEFAULT_MARKETS = [
  { key: 'in-realestate', country: 'IN', vertical: 'Real estate brokerages, developers and proptech', city: 'Delhi NCR', industry: 'realestate', status: 'active' },
  { key: 'in-clinics', country: 'IN', vertical: 'Clinics, hospitals and diagnostic labs', city: 'Delhi NCR', industry: 'generic', status: 'testing' },
  { key: 'in-coaching', country: 'IN', vertical: 'Coaching institutes and test-prep centres', city: 'Delhi NCR', industry: 'generic', status: 'testing' },
  { key: 'in-homeservices', country: 'IN', vertical: 'Home services: interiors, repairs, pest control', city: 'Delhi NCR', industry: 'homeservices', status: 'testing' },
  { key: 'gb-estateagents', country: 'GB', vertical: 'Estate and letting agents (limited companies)', city: 'London and South East England', industry: 'realestate', status: 'testing', intl: true },
  { key: 'au-trades', country: 'AU', vertical: 'Trades and home services: plumbers, electricians, air conditioning', city: 'Sydney and Melbourne', industry: 'homeservices', status: 'testing', intl: true },
  { key: 'sg-clinics', country: 'SG', vertical: 'Dental and aesthetic clinics', city: 'Singapore', industry: 'generic', status: 'testing', intl: true },
];

export const MARKET_STATUSES = ['testing', 'active', 'paused'];

export function sanitiseMarket(input = {}, base = {}) {
  const out = { status: 'testing', industry: 'generic', brief: '', country: 'IN', ...base };
  if (input.vertical !== undefined) out.vertical = oneLine(input.vertical, 120);
  if (input.city !== undefined) out.city = oneLine(input.city, 80);
  if (input.industry !== undefined && DEMO_INDUSTRIES.includes(input.industry)) out.industry = input.industry;
  if (input.status !== undefined && MARKET_STATUSES.includes(input.status)) out.status = input.status;
  if (input.country !== undefined) {
    if (!COUNTRIES[input.country]) throw new Error('The autopilot can’t email businesses in that country.');
    out.country = input.country;
    if (input.timezone === undefined) delete out.timezone;
  }
  if (input.timezone !== undefined) {
    const tz = String(input.timezone || '').trim();
    if (tz && !validTz(tz)) throw new Error('That time zone isn’t recognised.');
    if (tz) out.timezone = tz;
    else delete out.timezone;
  }
  if (!out.vertical) throw new Error('Describe the kind of business to target.');
  if (!out.city) throw new Error('Add a city or region.');
  return out;
}

export const marketTz = (m) => (m?.timezone && validTz(m.timezone) ? m.timezone : countryOf(m).tz);

// How each market is doing, from its prospects. A "win" is a prospect who
// replied with interest or tried their demo.
export function marketStats(prospects) {
  const stats = {};
  for (const p of prospects) {
    const s = (stats[p.marketId] ||= { found: 0, rejected: 0, sent: 0, replied: 0, interested: 0, engaged: 0, unsubscribed: 0, bounced: 0, wins: 0 });
    s.found++;
    if (p.stage === 'rejected') s.rejected++;
    if ((p.emails || []).some((e) => e.kind === 'first' && !e.sandbox) || (p.linkedinSentAt && !p.emails?.length)) s.sent++;
    if (p.reply) s.replied++;
    if (p.reply?.label === 'interested') s.interested++;
    if (p.engagedAt) s.engaged++;
    if (p.stage === 'unsubscribed') s.unsubscribed++;
    if (p.stage === 'bounced') s.bounced++;
    if (p.engagedAt || p.reply?.label === 'interested') s.wins++;
  }
  return stats;
}

// Expected win rate with a small prior, so a market with 3 sends and 1 win
// doesn't look better than one with 200 sends and 20.
export function winRate(s = {}) {
  return ((s.wins || 0) + 1) / ((s.sent || 0) + 10);
}

// Pick the market to research next. Every market that isn't paused gets a
// share in proportion to its win rate, and a market still being tested never
// drops below a floor, so it gets enough sends to be judged. `rand` is
// injectable for tests.
export function chooseMarket(markets, stats, rand = Math.random) {
  const live = markets.filter((m) => m.status !== 'paused');
  if (!live.length) return null;
  const rates = live.map((m) => winRate(stats[m.id]));
  const total = rates.reduce((a, b) => a + b, 0);
  const floor = 0.15 / live.length;
  const weights = live.map((m, i) => Math.max(rates[i] / total, m.status === 'testing' ? floor : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rand() * sum;
  for (let i = 0; i < live.length; i++) {
    r -= weights[i];
    if (r <= 0) return live[i];
  }
  return live[live.length - 1];
}

// Weekly review: what each market's status should become.
//   - no wins after 100 real sends: pause it
//   - a market under test with a win rate at least as good as the best active
//     one, after 30 sends: promote it to active
export const PAUSE_AFTER_SENDS = 100;
export const PROMOTE_AFTER_SENDS = 30;

export function reviewMarkets(markets, stats) {
  const activeRates = markets.filter((m) => m.status === 'active').map((m) => winRate(stats[m.id]));
  const bestActive = activeRates.length ? Math.max(...activeRates) : 0;
  const changes = [];
  for (const m of markets) {
    const s = stats[m.id] || {};
    if (m.status !== 'paused' && (s.sent || 0) >= PAUSE_AFTER_SENDS && !(s.wins > 0)) {
      changes.push({ id: m.id, status: 'paused', why: `No replies or demo calls after ${s.sent} emails.` });
    } else if (m.status === 'testing' && (s.sent || 0) >= PROMOTE_AFTER_SENDS && s.wins > 0 && winRate(s) >= bestActive) {
      changes.push({ id: m.id, status: 'active', why: `${s.wins} of ${s.sent} prospects responded, as well as the best market so far.` });
    }
  }
  return changes;
}

// ------------------------------------------------------------ prospects

// The company's web address reduced to its host, for spotting duplicates.
export function domainOf(url) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(String(url)) ? String(url) : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

// A company name reduced for matching: "Acme Realty Pvt. Ltd." -> "acme realty".
export function nameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(pvt|private|ltd|limited|llp|inc|co|company|the)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Keep a LinkedIn company or person page; drop anything else.
export function cleanLinkedin(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return '';
    if (!/^\/(company|in|school)\/[^/]+/i.test(u.pathname)) return '';
    return `https://www.linkedin.com${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

// Candidates from research that aren't already known, by domain or by name.
export function freshCandidates(candidates, known) {
  const domains = new Set(known.domains);
  const names = new Set(known.names);
  const out = [];
  for (const c of candidates) {
    const domain = domainOf(c.website);
    const key = nameKey(c.name);
    if (!domain || !key || domains.has(domain) || names.has(key)) continue;
    domains.add(domain);
    names.add(key);
    out.push({ ...c, domain });
  }
  return out;
}

// The emails of a prospect's sequence, in order: first, then follow-ups.
export function sequenceKinds(settings) {
  return ['first', ...settings.followupDays.map((_, i) => `followup_${i + 1}`)];
}

const DAY = 86_400_000;

// Which email of the sequence is due now, or null. The first email goes as
// soon as the prospect is approved; each follow-up waits its number of days
// after the first email. Nothing goes to a prospect who replied, tried the
// demo, unsubscribed or bounced (those stages are final).
export function nextEmail(p, settings, now = Date.now()) {
  if (!p.contact?.email || !p.draft) return null;
  const sent = (p.emails || []).map((e) => e.kind);
  if (p.stage === 'approved') return sent.includes('first') ? null : { kind: 'first' };
  if (!SEQUENCE_STAGES.includes(p.stage)) return null;
  const first = (p.emails || []).find((e) => e.kind === 'first');
  if (!first) return null;
  const kinds = sequenceKinds(settings);
  for (let i = 1; i < kinds.length; i++) {
    if (sent.includes(kinds[i])) continue;
    const due = Date.parse(first.at) + settings.followupDays[i - 1] * DAY;
    return now >= due && p.draft.followups?.[i - 1]?.body ? { kind: kinds[i] } : null;
  }
  return null;
}

// The stage a prospect moves to after an email of `kind` goes out.
export const stageAfter = (kind) => (kind === 'first' ? 'sent' : kind);

// ------------------------------------------------------------ time and caps

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const partsFormats = {};

// The date and time in a time zone, whatever the server's own zone (and
// daylight saving in it).
export function localParts(date = new Date(), tz = 'Asia/Kolkata') {
  const fmt = (partsFormats[tz] ||= new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }));
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, weekday: WEEKDAYS[p.weekday], hour: Number(p.hour) + Number(p.minute) / 60 };
}

// Daily caps and the usage log count by the operator's day, in India.
export const istParts = (date = new Date()) => localParts(date, 'Asia/Kolkata');
export const istDay = (date = new Date()) => istParts(date).day;

// Whether it's business hours for the recipient, in their time zone.
export function inSendWindow(window, date = new Date(), tz = 'Asia/Kolkata') {
  const { weekday, hour } = localParts(date, tz);
  return window.days.includes(weekday) && hour >= window.start && hour < window.end;
}

// Today's email cap: the warm-up ramp counts from the first real send, and
// never exceeds the configured cap.
export function emailCapToday(settings, firstSendDay, today = istDay()) {
  if (!firstSendDay) return Math.min(settings.caps.emails, settings.warmup.start);
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(firstSendDay)) / DAY));
  return Math.min(settings.caps.emails, settings.warmup.start + settings.warmup.step * days);
}

// What remains of today's allowance for a step ('qualify', 'demos', ...).
export function remaining(settings, usageToday = {}, step, { firstSendDay, today } = {}) {
  const cap = step === 'emails' ? emailCapToday(settings, firstSendDay, today) : settings.caps[step] ?? 0;
  return Math.max(0, cap - (usageToday[step] || 0));
}

export const overBudget = (settings, usageToday = {}) => (usageToday.usd || 0) >= settings.spendUsd;
