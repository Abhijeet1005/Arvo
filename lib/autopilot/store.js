// The autopilot's state, in .autopilot.json:
//   settings, markets[], prospects[] (newest first), suppression { emails, domains },
//   usage { days: { 'YYYY-MM-DD': { usd, research, qualify, demos, drafts, emails } }, firstSendDay },
//   events[] (activity feed, newest first), reports[], posts[], meta { lastLearnAt, lastInboxUid }
//
// Storage only: the rules live in ./model.js. Every change goes through
// mutate(), so the scheduler and a dashboard click can't overwrite each other.
// Server-only.
import { createHash, randomBytes } from 'node:crypto';
import { jsonStore } from '@/lib/store';
import { DEFAULT_MARKETS, DEFAULT_SETTINGS, sanitiseSettings, istDay, domainOf, nameKey, cleanPublicUrl, FREE_MAIL } from './model';

const store = jsonStore('.autopilot.json');

const MAX_EVENTS = 300;
const MAX_REPORTS = 12;
const MAX_POSTS = 30;
const USAGE_DAYS = 60;
export const MAX_PROSPECTS = 5000;

export const newId = (prefix) => `${prefix}_${randomBytes(8).toString('hex').slice(0, 10)}`;
export const newToken = () => randomBytes(16).toString('base64url');

// The server's own address (ARVO_PUBLIC_URL, set by the deploy when the server
// has a domain) wins over the one remembered from the dashboard.
export const serverPublicUrl = () => cleanPublicUrl(process.env.ARVO_PUBLIC_URL);

function withServerUrl(settings) {
  const url = serverPublicUrl();
  return url ? { ...settings, publicUrl: url } : settings;
}

// A starting market as stored: a stable id from its key, so the same market
// comes back on every read until it is saved.
function startingMarket({ key, intl, ...m }, now) {
  return { id: `mkt_${createHash('sha1').update(key).digest('hex').slice(0, 10)}`, brief: '', createdAt: now, ...m };
}

// The markets: the starting set on a fresh install. Installs from before
// markets had a country were all India; they also get the international
// starting markets, once.
function marketsOf(raw, meta, now) {
  if (!Array.isArray(raw.markets)) {
    meta.intlMarkets = true;
    return DEFAULT_MARKETS.map((m) => startingMarket(m, now));
  }
  const markets = raw.markets.map((m) => (m.country ? m : { ...m, country: 'IN' }));
  if (!meta.intlMarkets) {
    meta.intlMarkets = true;
    for (const m of DEFAULT_MARKETS.filter((x) => x.intl)) {
      const market = startingMarket(m, now);
      if (!markets.some((x) => x.id === market.id)) markets.push(market);
    }
  }
  return markets;
}

// Fill in anything missing, so callers never check for undefined keys. The
// starting markets are added the first time the file is read.
function normalise(raw = {}) {
  const now = new Date().toISOString();
  const meta = { ...(raw.meta || {}) };
  return {
    ...raw,
    settings: withServerUrl(sanitiseSettings({}, { ...DEFAULT_SETTINGS, ...(raw.settings || {}) })),
    markets: marketsOf(raw, meta, now),
    prospects: Array.isArray(raw.prospects) ? raw.prospects : [],
    suppression: { emails: [], domains: [], ...(raw.suppression || {}) },
    usage: { days: {}, firstSendDay: null, ...(raw.usage || {}) },
    events: Array.isArray(raw.events) ? raw.events : [],
    reports: Array.isArray(raw.reports) ? raw.reports : [],
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    meta,
  };
}

export async function readState() {
  return normalise(await store.read());
}

// Atomic change. `fn` gets the state and changes it in place (or returns a
// value for the caller). Returns { state, result }.
export async function mutate(fn) {
  let result;
  const next = await store.update(async (raw) => {
    const state = normalise(raw);
    result = await fn(state);
    trim(state);
    return state;
  });
  return { state: next, result };
}

function trim(state) {
  state.events.length = Math.min(state.events.length, MAX_EVENTS);
  state.reports.length = Math.min(state.reports.length, MAX_REPORTS);
  state.posts.length = Math.min(state.posts.length, MAX_POSTS);
  const days = Object.keys(state.usage.days).sort();
  for (const d of days.slice(0, Math.max(0, days.length - USAGE_DAYS))) delete state.usage.days[d];
  // Past the limit, the oldest companies that were turned down go first; they
  // only matter for not researching them again, and their domain does that.
  if (state.prospects.length > MAX_PROSPECTS) {
    const keep = state.prospects.filter((p) => p.stage !== 'rejected');
    const rejected = state.prospects.filter((p) => p.stage === 'rejected');
    state.prospects = [...keep, ...rejected.slice(0, Math.max(0, MAX_PROSPECTS - keep.length))];
  }
}

// ------------------------------------------------------------ helpers used inside mutate()

export function logEvent(state, text, { kind = 'info', prospectId } = {}) {
  state.events.unshift({ at: new Date().toISOString(), kind, text: String(text).slice(0, 300), ...(prospectId ? { prospectId } : {}) });
}

export function usageToday(state, day = istDay()) {
  return (state.usage.days[day] ||= {});
}

export function addUsage(state, counts, day = istDay()) {
  const today = usageToday(state, day);
  for (const [k, v] of Object.entries(counts)) today[k] = Math.round(((today[k] || 0) + v) * 10000) / 10000;
}

export const findProspect = (state, id) => state.prospects.find((p) => p.id === id);

export function setStage(p, stage, extra = {}) {
  Object.assign(p, extra, { stage, updatedAt: new Date().toISOString() });
  delete p.error;
  p.attempts = 0;
}

// A turned-down company keeps only what stops it being researched again.
export function compactRejected(p, reason) {
  for (const k of Object.keys(p)) {
    if (!['id', 'marketId', 'name', 'domain', 'website', 'city', 'createdAt', 'fit', 'linkedin', 'revivedAt'].includes(k)) delete p[k];
  }
  setStage(p, 'rejected', { fit: { score: p.fit?.score ?? 0, reason: String(reason || p.fit?.reason || '').slice(0, 300) } });
}

export function isSuppressed(state, email) {
  const e = String(email || '').toLowerCase();
  return state.suppression.emails.includes(e) || state.suppression.domains.includes(e.split('@')[1] || '');
}

// Unsubscribing stops the whole company (anyone at that domain); a bounce
// only stops that one address.
export function suppress(state, email, { wholeDomain = false } = {}) {
  const e = String(email || '').toLowerCase();
  if (!e) return;
  if (!state.suppression.emails.includes(e)) state.suppression.emails.push(e);
  const domain = e.split('@')[1];
  // Never block a whole mail provider because one person on it unsubscribed.
  if (wholeDomain && domain && !FREE_MAIL.has(domain) && !state.suppression.domains.includes(domain)) state.suppression.domains.push(domain);
}


// Everything already known, for skipping duplicates in research.
export function knownCompanies(state, extra = { domains: [], names: [] }) {
  return {
    domains: [...state.prospects.map((p) => p.domain || domainOf(p.website)), ...extra.domains].filter(Boolean),
    names: [...state.prospects.map((p) => nameKey(p.name)), ...extra.names].filter(Boolean),
  };
}
