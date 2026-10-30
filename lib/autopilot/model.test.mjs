// Tests for the autopilot's rules (lib/autopilot/model.js). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  sanitiseSettings,
  sendingGaps,
  cleanPublicUrl,
  domainOf,
  nameKey,
  cleanLinkedin,
  freshCandidates,
  nextEmail,
  stageAfter,
  istParts,
  inSendWindow,
  emailCapToday,
  remaining,
  overBudget,
  marketStats,
  winRate,
  chooseMarket,
  reviewMarkets,
  sanitiseMarket,
  COUNTRIES,
  countryOf,
  marketBlock,
  marketTz,
  localParts,
  summaryLines,
  extractEmails,
  emailCandidates,
  creditStatus,
  creditAlertDue,
} from './model.js';
import { linkedinFrom, parseHtml } from '../demos/site.js';

const DAY = 86_400_000;
const settings = (patch = {}) => sanitiseSettings(patch, DEFAULT_SETTINGS);

test('settings: defaults are safe (paused, sandbox on)', () => {
  const s = settings();
  assert.equal(s.mode, 'paused');
  assert.equal(s.sandbox, true);
});

test('settings: summary and report emails are off unless switched on', () => {
  assert.deepEqual(settings().alerts, { daily: false, weekly: false });
  const on = settings({ alerts: { daily: true } });
  assert.deepEqual(on.alerts, { daily: true, weekly: false });
  assert.deepEqual(sanitiseSettings({ alerts: { weekly: 'yes' } }, on).alerts, { daily: true, weekly: false });
});

test('settings: clamps numbers and ignores bad values', () => {
  const s = settings({ mode: 'turbo', caps: { emails: '9999', demos: -3 }, spendUsd: 'abc', minFit: 140, sandboxTo: 'not-an-email' });
  assert.equal(s.mode, 'paused');
  assert.equal(s.caps.emails, 300);
  assert.equal(s.caps.demos, 0);
  assert.equal(s.spendUsd, DEFAULT_SETTINGS.spendUsd);
  assert.equal(s.minFit, 100);
  assert.equal(s.sandboxTo, '');
});

test('settings: window end always after start; days deduped and sorted', () => {
  const s = settings({ window: { start: 18, end: 10, days: [5, 1, 1, 9] } });
  assert.equal(s.window.start, 18);
  assert.equal(s.window.end, 19);
  assert.deepEqual(s.window.days, [1, 5]);
});

test('settings: keeps nested values not mentioned', () => {
  const base = settings({ sender: { name: 'Abhi', address: 'Gurgaon' } });
  const s = sanitiseSettings({ sender: { title: 'Founder' } }, base);
  assert.equal(s.sender.name, 'Abhi');
  assert.equal(s.sender.title, 'Founder');
});

test('sendingGaps lists what blocks sending (a postal address is not one of them)', () => {
  assert.equal(sendingGaps(settings(), { smtp: false }).length, 3);
  const ready = settings({ sender: { name: 'A' }, sandbox: false, publicUrl: 'https://arvo.example.com' });
  assert.deepEqual(sendingGaps(ready, { smtp: true }), []);
});

test('countries: the US needs a postal address, others do not; Canada and the EU are absent', () => {
  const noAddress = settings();
  const withAddress = settings({ sender: { address: '1 Main St, Gurugram' } });
  assert.match(marketBlock({ country: 'US' }, noAddress), /postal address/);
  assert.equal(marketBlock({ country: 'US' }, withAddress), '');
  for (const c of ['IN', 'GB', 'AU', 'SG']) assert.equal(marketBlock({ country: c }, noAddress), '', c);
  for (const c of ['CA', 'DE', 'FR']) assert.equal(COUNTRIES[c], undefined, c);
  assert.equal(countryOf({}).name, 'India');
});

test('sanitiseMarket: country and time zone', () => {
  const uk = sanitiseMarket({ vertical: 'Estate agents', city: 'Leeds', country: 'GB' });
  assert.equal(uk.country, 'GB');
  assert.equal(marketTz(uk), 'Europe/London');
  assert.throws(() => sanitiseMarket({ vertical: 'Gyms', city: 'Toronto', country: 'CA' }), /can’t email/);
  assert.throws(() => sanitiseMarket({ vertical: 'Gyms', city: 'X', country: 'GB', timezone: 'Mars/Base' }), /time zone/);
  const west = sanitiseMarket({ vertical: 'Dentists', city: 'LA', country: 'US', timezone: 'America/Los_Angeles' });
  assert.equal(marketTz(west), 'America/Los_Angeles');
  // Changing the country drops a time zone chosen for the old one.
  assert.equal(marketTz(sanitiseMarket({ country: 'AU' }, west)), 'Australia/Sydney');
  assert.equal(sanitiseMarket({ vertical: 'A', city: 'B' }).country, 'IN');
});

test('send window follows the recipient’s time zone, daylight saving included', () => {
  const w = DEFAULT_SETTINGS.window; // Mon-Fri 10:00-18:00
  // Monday 2 Nov 2026, 09:30 UTC: 15:00 in India, 09:30 in London (GMT), 20:30 in Sydney (AEDT).
  const t = new Date('2026-11-02T09:30:00Z');
  assert.equal(inSendWindow(w, t, 'Asia/Kolkata'), true);
  assert.equal(inSendWindow(w, t, 'Europe/London'), false);
  assert.equal(inSendWindow(w, t, 'Australia/Sydney'), false);
  assert.equal(inSendWindow(w, new Date('2026-11-02T10:00:00Z'), 'Europe/London'), true);
  // In July London is on BST (UTC+1): 09:30 UTC is 10:30 there.
  assert.equal(inSendWindow(w, new Date('2026-07-06T09:30:00Z'), 'Europe/London'), true);
  // Monday 02:00 UTC is Monday 13:00 in Sydney (AEDT, UTC+11).
  assert.deepEqual(localParts(new Date('2026-11-02T02:00:00Z'), 'Australia/Sydney'), { day: '2026-11-02', weekday: 1, hour: 13 });
});

test('public URL: https host or local http only', () => {
  assert.equal(cleanPublicUrl('https://arvo.example.com/'), 'https://arvo.example.com');
  assert.equal(cleanPublicUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(cleanPublicUrl('http://arvo.example.com'), '');
  assert.equal(cleanPublicUrl('https://arvo.example.com/path'), '');
});

test('domainOf / nameKey normalise for duplicate checks', () => {
  assert.equal(domainOf('https://www.Acme.in/about'), 'acme.in');
  assert.equal(domainOf('acme.in'), 'acme.in');
  assert.equal(domainOf('::::'), '');
  assert.equal(nameKey('Acme Realty Pvt. Ltd.'), 'acme realty');
  assert.equal(nameKey('The A&B Co'), 'a and b');
});

test('cleanLinkedin keeps company/person pages only', () => {
  assert.equal(cleanLinkedin('https://in.linkedin.com/company/acme/'), 'https://www.linkedin.com/company/acme');
  assert.equal(cleanLinkedin('https://www.linkedin.com/feed'), '');
  assert.equal(cleanLinkedin('https://evil.com/company/acme'), '');
  assert.equal(cleanLinkedin('javascript:alert(1)'), '');
});

test('freshCandidates drops known domains/names and repeats within the batch', () => {
  const out = freshCandidates(
    [
      { name: 'Acme Realty', website: 'https://acme.in' },
      { name: 'Acme Realty Pvt Ltd', website: 'https://acme-realty.com' },
      { name: 'Beta Homes', website: 'www.beta.in' },
      { name: 'Beta Homes 2', website: 'https://beta.in/contact' },
      { name: 'Gamma', website: '' },
      { name: 'Delta', website: 'https://known.in' },
    ],
    { domains: ['known.in'], names: [] }
  );
  assert.deepEqual(out.map((c) => c.name), ['Acme Realty', 'Beta Homes']);
  assert.equal(out[1].domain, 'beta.in');
});

function prospect(patch = {}) {
  return {
    stage: 'approved',
    contact: { email: 'a@acme.in' },
    draft: { subject: 's', body: 'b', followups: [{ body: 'f1' }, { body: 'f2' }], linkedin: 'l' },
    emails: [],
    ...patch,
  };
}

test('nextEmail: first email when approved, nothing without an address', () => {
  const s = settings();
  assert.deepEqual(nextEmail(prospect(), s), { kind: 'first' });
  assert.equal(nextEmail(prospect({ contact: {} }), s), null);
  assert.equal(nextEmail(prospect({ stage: 'drafted' }), s), null);
});

test('nextEmail: follow-ups wait their days, in order, and stop at final stages', () => {
  const s = settings();
  const t0 = Date.parse('2026-11-02T05:00:00Z');
  const sent = prospect({ stage: 'sent', emails: [{ kind: 'first', at: new Date(t0).toISOString() }] });
  assert.equal(nextEmail(sent, s, t0 + 2 * DAY), null);
  assert.deepEqual(nextEmail(sent, s, t0 + 3 * DAY), { kind: 'followup_1' });

  const one = { ...sent, stage: 'followup_1', emails: [...sent.emails, { kind: 'followup_1', at: new Date(t0 + 3 * DAY).toISOString() }] };
  assert.equal(nextEmail(one, s, t0 + 6 * DAY), null);
  assert.deepEqual(nextEmail(one, s, t0 + 7 * DAY), { kind: 'followup_2' });

  const two = { ...one, stage: 'followup_2', emails: [...one.emails, { kind: 'followup_2', at: new Date(t0 + 7 * DAY).toISOString() }] };
  assert.equal(nextEmail(two, s, t0 + 30 * DAY), null);

  for (const stage of ['replied', 'engaged', 'unsubscribed', 'bounced', 'closed']) {
    assert.equal(nextEmail({ ...sent, stage }, s, t0 + 30 * DAY), null, stage);
  }
  assert.equal(stageAfter('first'), 'sent');
  assert.equal(stageAfter('followup_2'), 'followup_2');
});

test('India time and the send window', () => {
  // 04:29 UTC on a Monday = 09:59 IST; 04:30 UTC = 10:00 IST.
  const w = DEFAULT_SETTINGS.window;
  assert.equal(istParts(new Date('2026-11-02T04:29:00Z')).weekday, 1);
  assert.equal(inSendWindow(w, new Date('2026-11-02T04:29:00Z')), false);
  assert.equal(inSendWindow(w, new Date('2026-11-02T04:30:00Z')), true);
  assert.equal(inSendWindow(w, new Date('2026-11-02T12:29:00Z')), true); // 17:59
  assert.equal(inSendWindow(w, new Date('2026-11-02T12:30:00Z')), false); // 18:00
  // 20:00 UTC Saturday is already Sunday 01:30 in India.
  assert.equal(istParts(new Date('2026-11-07T20:00:00Z')).day, '2026-11-08');
  assert.equal(inSendWindow(w, new Date('2026-11-08T06:00:00Z')), false); // Sunday
});

test('warm-up ramps from the first real send up to the cap', () => {
  const s = settings({ caps: { emails: 40 }, warmup: { start: 10, step: 5 } });
  assert.equal(emailCapToday(s, null, '2026-11-02'), 10);
  assert.equal(emailCapToday(s, '2026-11-02', '2026-11-02'), 10);
  assert.equal(emailCapToday(s, '2026-11-02', '2026-11-04'), 20);
  assert.equal(emailCapToday(s, '2026-11-02', '2026-12-30'), 40);
  assert.equal(remaining(s, { emails: 18 }, 'emails', { firstSendDay: '2026-11-02', today: '2026-11-04' }), 2);
  assert.equal(remaining(s, { demos: 12 }, 'demos'), 0);
});

test('budget', () => {
  const s = settings({ spendUsd: 5 });
  assert.equal(overBudget(s, { usd: 4.99 }), false);
  assert.equal(overBudget(s, { usd: 5 }), true);
});

const P = (marketId, patch) => ({ marketId, stage: 'sent', emails: [{ kind: 'first', at: '2026-11-02T05:00:00Z' }], ...patch });

test('marketStats counts only real sends and wins', () => {
  const stats = marketStats([
    P('a'),
    P('a', { emails: [{ kind: 'first', sandbox: true }] }),
    P('a', { stage: 'engaged', engagedAt: 'x' }),
    P('a', { stage: 'replied', reply: { label: 'interested' } }),
    P('a', { stage: 'replied', reply: { label: 'not_now' } }),
    { marketId: 'a', stage: 'rejected' },
  ]);
  assert.equal(stats.a.found, 6);
  assert.equal(stats.a.sent, 4);
  assert.equal(stats.a.wins, 2);
  assert.equal(stats.a.replied, 2);
  assert.equal(stats.a.rejected, 1);
});

test('chooseMarket skips paused markets and favours what works', () => {
  const markets = [
    { id: 'good', status: 'active' },
    { id: 'bad', status: 'active' },
    { id: 'off', status: 'paused' },
  ];
  const stats = { good: { sent: 100, wins: 20 }, bad: { sent: 100, wins: 0 } };
  const counts = { good: 0, bad: 0, off: 0 };
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) counts[chooseMarket(markets, stats, rand).id]++;
  assert.equal(counts.off, 0);
  assert.ok(counts.good > counts.bad * 5, JSON.stringify(counts));
  assert.equal(chooseMarket([{ id: 'x', status: 'paused' }], {}), null);
});

test('chooseMarket keeps a floor for markets under test', () => {
  const markets = [
    { id: 'star', status: 'active' },
    { id: 'new', status: 'testing' },
  ];
  const stats = { star: { sent: 1000, wins: 500 }, new: { sent: 0, wins: 0 } };
  let n = 0;
  for (let i = 0; i < 1000; i++) if (chooseMarket(markets, stats, () => i / 1000).id === 'new') n++;
  assert.ok(n >= 70, `new market chosen ${n}/1000`);
});

test('reviewMarkets pauses silent markets and promotes good tests', () => {
  const markets = [
    { id: 'silent', status: 'active' },
    { id: 'best', status: 'active' },
    { id: 'rising', status: 'testing' },
    { id: 'young', status: 'testing' },
  ];
  const stats = {
    silent: { sent: 120, wins: 0 },
    best: { sent: 200, wins: 10 },
    rising: { sent: 40, wins: 4 },
    young: { sent: 10, wins: 3 },
  };
  const changes = Object.fromEntries(reviewMarkets(markets, stats).map((c) => [c.id, c.status]));
  assert.deepEqual(changes, { silent: 'paused', rising: 'active' });
  assert.ok(winRate(stats.rising) > winRate(stats.best));
});

test('sanitiseMarket requires a vertical and a city', () => {
  assert.throws(() => sanitiseMarket({ city: 'Pune' }));
  assert.throws(() => sanitiseMarket({ vertical: 'Gyms' }));
  const m = sanitiseMarket({ vertical: ' Gyms ', city: 'Pune', industry: 'nope', status: 'active' });
  assert.equal(m.vertical, 'Gyms');
  assert.equal(m.industry, 'generic');
  assert.equal(m.status, 'active');
});

test('daily summary: nothing to say means no email; otherwise drafts, replies, demos, sends', () => {
  const since = Date.parse('2026-11-02T00:00:00Z');
  const quiet = { settings: settings(), events: [], prospects: [{ stage: 'sent', createdAt: '2026-10-01T00:00:00Z', emails: [{ kind: 'first', at: '2026-10-01T05:00:00Z' }] }] };
  assert.equal(summaryLines(quiet, since), null);

  const busy = {
    settings: settings({ spendUsd: 5 }),
    events: [{ kind: 'error', at: '2026-11-02T08:00:00Z', text: 'Send failed: login refused' }],
    prospects: [
      { name: 'Acme', stage: 'drafted', fit: { score: 88, reason: 'Busy front desk' }, createdAt: '2026-11-02T06:00:00Z' },
      { name: 'Beta', stage: 'replied', reply: { at: '2026-11-02T09:00:00Z', label: 'interested', summary: 'Wants a call' }, emails: [{ kind: 'first', at: '2026-11-02T05:00:00Z', sandbox: true }] },
      { name: 'Gamma', stage: 'engaged', engagedAt: '2026-11-02T10:00:00Z', contact: { email: 'g@gamma.in' } },
    ],
  };
  const text = summaryLines(busy, since, { usd: 1.234 }).join('\n');
  assert.match(text, /Waiting for your approval \(1\):\n  • Acme \(88\/100\): Busy front desk/);
  assert.match(text, /Beta \(interested\): Wants a call/);
  assert.match(text, /Gamma \(g@gamma\.in\)/);
  // A test copy (sandbox) isn't counted as sent.
  assert.match(text, /0 emails sent, 1 new company found/);
  assert.match(text, /Claude today: \$1\.23 of \$5\.00/);
  assert.match(text, /Send failed: login refused/);
});

test('extractEmails: plain and "[at]/[dot]" forms, junk dropped', () => {
  const text = `Write to Lettings@ARLets.co.uk. or sales [at] arlets [dot] co [dot] uk, careers@arlets.co.uk,
    noreply@arlets.co.uk, logo@2x.png, someone@example.com, john (at) gmail (dot) com`;
  assert.deepEqual(extractEmails(text).sort(), ['john@gmail.com', 'lettings@arlets.co.uk', 'sales@arlets.co.uk']);
});

test('extractEmails decodes Cloudflare-protected addresses', () => {
  // "info@shop.in" encoded with key 0x42, as Cloudflare writes it in a link.
  const hex = '42' + [...'info@shop.in'].map((c) => (c.charCodeAt(0) ^ 0x42).toString(16).padStart(2, '0')).join('');
  assert.deepEqual(extractEmails(`Email: [[email protected]](https://shop.in/cdn-cgi/l/email-protection#${hex})`), ['info@shop.in']);
  assert.deepEqual(extractEmails(`<a class="__cf_email__" data-cfemail="${hex}">[email&#160;protected]</a>`), ['info@shop.in']);
});

test('emailCandidates: own domain first, role before person, never another company', () => {
  const pages = [
    { url: 'https://www.yell.com/biz/ar-lettings-hove', text: 'AR Lettings, Hove. Email jane.doe@arlets.co.uk. Other listing: info@otheragent.co.uk' },
    { url: 'https://arlets.co.uk/contact', text: 'Contact us: lettings@arlets.co.uk' },
  ];
  const got = emailCandidates(pages, { domain: 'https://www.arlets.co.uk/', name: 'AR Lettings (trading name of Austin Rees Ltd)' });
  assert.deepEqual(got.map((c) => c.email), ['lettings@arlets.co.uk', 'jane.doe@arlets.co.uk']);
  assert.equal(got[0].source, 'https://arlets.co.uk/contact');
});

test('emailCandidates: free-mail only from their own site, or a listing that names them', () => {
  const name = 'Sanskriti IAS';
  const domain = 'sanskritiias.com';
  // On their own site: fine.
  assert.deepEqual(emailCandidates([{ url: 'https://sanskritiias.com/contact', text: 'sanskritiias@gmail.com' }], { domain, name }).map((c) => c.email), ['sanskritiias@gmail.com']);
  // On a directory page that names them, with few addresses: fine.
  assert.equal(emailCandidates([{ url: 'https://www.justdial.com/x', text: 'Sanskriti IAS Mukherjee Nagar — sanskriti.delhi@gmail.com' }], { domain, name }).length, 1);
  // A directory page that doesn't name them, or lists many addresses: not trusted.
  assert.equal(emailCandidates([{ url: 'https://www.justdial.com/x', text: 'Top IAS coaching — a@gmail.com' }], { domain, name }).length, 0);
  assert.equal(
    emailCandidates([{ url: 'https://www.justdial.com/x', text: 'Sanskriti IAS a@gmail.com b@gmail.com c@gmail.com d@gmail.com' }], { domain, name }).length,
    0
  );
  // Another company's corporate address is never picked.
  assert.equal(emailCandidates([{ url: 'https://sanskritiias.com/partners', text: 'partner@otherinstitute.in' }], { domain, name }).length, 0);
});

test('creditStatus: levels from what is left and the pace of use', () => {
  const H = 3_600_000;
  const now = Date.parse('2026-11-02T12:00:00Z');
  const resetAt = now + 20 * 24 * H;
  // Plenty left, slow pace: ok.
  assert.equal(creditStatus({ used: 10_000, limit: 100_000, resetAt }, [{ at: now - 24 * H, used: 9_000 }], now).level, 'ok');
  // Under 20% left: low.
  assert.equal(creditStatus({ used: 85_000, limit: 100_000, resetAt }, [], now).level, 'low');
  // Under 5% left: critical. Nothing left: empty.
  assert.equal(creditStatus({ used: 96_000, limit: 100_000, resetAt }, [], now).level, 'critical');
  assert.equal(creditStatus({ used: 100_000, limit: 100_000, resetAt }, [], now).level, 'empty');
  // 50% left but burning 10k a day with 20 days to the reset: runs out first, low.
  const fast = creditStatus({ used: 50_000, limit: 100_000, resetAt }, [{ at: now - 24 * H, used: 40_000 }], now);
  assert.equal(fast.level, 'low');
  assert.equal(Math.round((fast.emptyAt - now) / H), 120);
  // ...and if that pace empties it within 2 days: critical.
  assert.equal(creditStatus({ used: 70_000, limit: 100_000, resetAt }, [{ at: now - 24 * H, used: 50_000 }], now).level, 'critical');
  // Too little history (under 3 hours) gives no pace.
  assert.equal(creditStatus({ used: 50_000, limit: 100_000, resetAt }, [{ at: now - H, used: 40_000 }], now).emptyAt, null);
});

test('creditAlertDue: only when it gets worse than what was already reported', () => {
  assert.equal(creditAlertDue('ok', undefined), false);
  assert.equal(creditAlertDue('low', undefined), true);
  assert.equal(creditAlertDue('low', 'low'), false);
  assert.equal(creditAlertDue('critical', 'low'), true);
  assert.equal(creditAlertDue('low', 'critical'), false);
  assert.equal(creditAlertDue('empty', 'critical'), true);
});

test('linkedinFrom prefers the company page over a person', () => {
  const page = parseHtml(
    '<a href="https://www.linkedin.com/in/founder">Founder</a><a href="https://in.linkedin.com/company/acme-realty?trk=x">Us</a>',
    'https://acme.in/'
  );
  assert.equal(linkedinFrom([page]), 'https://www.linkedin.com/company/acme-realty');
  assert.equal(linkedinFrom([parseHtml('<a href="https://linkedin.com/in/solo/">x</a>', 'https://a.in/')]), 'https://www.linkedin.com/in/solo');
  assert.equal(linkedinFrom([parseHtml('<p>none</p>', 'https://a.in/')]), '');
});
