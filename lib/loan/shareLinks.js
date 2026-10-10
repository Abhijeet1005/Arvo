// Share links for the loan advisor, stored under `loanLinks` in .agent.json.
//
// A share link is a token an operator hands to one customer so they can open
// a public, branded page and start (or watch) a call themselves — the "send
// this to a prospective client" mechanic. A plain link only ever points at
// whatever the *current* live settings and agent are at call time (see
// lib/loan/agent.js) — it never freezes a snapshot of the config.
//
// A *demo* link (see lib/demos) carries a `demoId` instead: it opens that
// demo's own branded room and agent, and it counts the calls started through
// it so a public link can't be used to drain the account.
//
// Pure-ish module like lib/loan/settings.js: storage + validation only, no
// ElevenLabs calls here.
import crypto from 'node:crypto';
import { readStore, updateStore } from '@/lib/store';

const KEY = 'loanLinks';
const MAX_LINKS = 2000;

// base64url of 16 random bytes is always 22 chars from [A-Za-z0-9_-], no
// padding — sliced defensively in case that ever changes.
const TOKEN_LENGTH = 22;
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,24}$/;
export const DEMO_ID_RE = /^dmo_[a-z0-9]{10}$/;

// expiresInDays convention used by createShareLink: undefined -> default
// (7 days), null -> never expires, a number -> clamped to 1-30 days.
const DEFAULT_EXPIRES_DAYS = 7;
const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 30;

// A demo link allows this many calls by default, spaced at least a few
// seconds apart.
export const DEFAULT_DEMO_SESSIONS = 6;
const SESSION_GAP_MS = 4000;

// Operator input dropped into the dashboard and the agent's dynamic
// variables, so kept plain — same rule as `clean()` in
// app/components/loan/LoanCall.jsx.
function clean(value, max) {
  return String(value || '')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// The note is operator-only and never shown to the client, so it only needs
// control characters stripped rather than the full `clean()` treatment.
function cleanNote(value) {
  return String(value || '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 200);
}

function generateToken() {
  return crypto.randomBytes(16).toString('base64url').slice(0, TOKEN_LENGTH);
}

function expiryFrom(expiresInDays) {
  if (expiresInDays === null) return null;
  const days = expiresInDays === undefined ? DEFAULT_EXPIRES_DAYS : Number(expiresInDays);
  const clamped = Number.isFinite(days)
    ? Math.min(MAX_EXPIRES_DAYS, Math.max(MIN_EXPIRES_DAYS, Math.round(days)))
    : DEFAULT_EXPIRES_DAYS;
  return new Date(Date.now() + clamped * 24 * 60 * 60 * 1000).toISOString();
}

async function readLinks() {
  const store = await readStore();
  return Array.isArray(store[KEY]) ? store[KEY] : [];
}

// Change the link list atomically. `fn` edits the array it is given (a copy)
// and may return a value, which is passed back to the caller.
async function mutateLinks(fn) {
  let result;
  await updateStore((store) => {
    const links = Array.isArray(store[KEY]) ? [...store[KEY]] : [];
    result = fn(links);
    return { ...store, [KEY]: links.slice(0, MAX_LINKS) };
  });
  return result;
}

// Create a link for one customer. Throws a plain Error with a display-ready
// message if customerName is blank after sanitising — callers should surface
// that as a 400. A demo link (demoId set) needs no customer: `label` is just
// what the operator sees in lists.
export async function createShareLink({ customerName, customerPhone, note, expiresInDays, demoId, label, maxSessions } = {}) {
  const isDemo = demoId !== undefined && demoId !== null && demoId !== '';
  if (isDemo && !DEMO_ID_RE.test(String(demoId))) throw new Error('That demo id is not valid.');

  const name = clean(isDemo ? label || customerName || 'Demo' : customerName, 40);
  if (!name) throw new Error('A customer name is required.');

  const link = {
    token: generateToken(),
    customerName: name,
    customerPhone: isDemo ? '' : clean(customerPhone, 20),
    note: cleanNote(note),
    createdAt: new Date().toISOString(),
    expiresAt: expiryFrom(expiresInDays),
    revoked: false,
    callIds: [],
    ...(isDemo
      ? {
          demoId: String(demoId),
          sessions: 0,
          maxSessions: Math.min(100, Math.max(1, Math.round(Number(maxSessions) || DEFAULT_DEMO_SESSIONS))),
        }
      : {}),
  };

  await mutateLinks((links) => {
    links.unshift(link);
  });
  return link;
}

// Newest first (new links are unshifted in, same as lib/loan/calls.js).
export async function listShareLinks() {
  return readLinks();
}

export async function listLinksForDemo(demoId) {
  return (await readLinks()).filter((l) => l.demoId === demoId);
}

// Validates the token shape before ever touching the store.
export async function getShareLink(token) {
  if (!TOKEN_RE.test(String(token ?? ''))) return null;
  const links = await readLinks();
  return links.find((l) => l.token === token) || null;
}

// { ok: true } or { ok: false, reason: 'revoked' | 'expired' | 'not_found' }
export function isLinkUsable(link) {
  if (!link) return { ok: false, reason: 'not_found' };
  if (link.revoked) return { ok: false, reason: 'revoked' };
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

// Idempotent: revoking an already-revoked (or missing) link is a no-op.
export async function revokeShareLink(token) {
  if (!TOKEN_RE.test(String(token ?? ''))) return null;
  return mutateLinks((links) => {
    const i = links.findIndex((l) => l.token === token);
    if (i === -1) return null;
    if (!links[i].revoked) links[i] = { ...links[i], revoked: true };
    return links[i];
  });
}

// Give back a reserved session when the call could not even be set up.
export async function releaseDemoSession(token) {
  if (!TOKEN_RE.test(String(token ?? ''))) return;
  await mutateLinks((links) => {
    const i = links.findIndex((l) => l.token === token);
    if (i === -1 || !(Number(links[i].sessions) > 0)) return;
    links[i] = { ...links[i], sessions: links[i].sessions - 1 };
  });
}

// Revoke every link that belongs to a demo (used when the demo is deleted).
export async function revokeLinksForDemo(demoId) {
  return mutateLinks((links) => {
    let n = 0;
    for (let i = 0; i < links.length; i++) {
      if (links[i].demoId === demoId && !links[i].revoked) {
        links[i] = { ...links[i], revoked: true };
        n++;
      }
    }
    return n;
  });
}

// A demo link's room registers each call it started, once. Only a call whose
// session was reserved first is accepted, so the public registration route
// can't be used to fill the call log with invented ids.
// -> { ok: true, link } | { ok: false, reason: 'not_found' | 'not_demo' | 'revoked' | 'limit' }
export async function claimDemoCall(token, conversationId) {
  if (!TOKEN_RE.test(String(token ?? ''))) return { ok: false, reason: 'not_found' };
  return mutateLinks((links) => {
    const i = links.findIndex((l) => l.token === token);
    if (i === -1) return { ok: false, reason: 'not_found' };
    const link = links[i];
    if (!link.demoId) return { ok: false, reason: 'not_demo' };
    if (link.revoked) return { ok: false, reason: 'revoked' };
    const callIds = Array.isArray(link.callIds) ? link.callIds : [];
    if (callIds.includes(conversationId)) return { ok: true, link, repeat: true };
    if (callIds.length >= (Number(link.sessions) || 0)) return { ok: false, reason: 'limit' };
    links[i] = { ...link, callIds: [...callIds, conversationId] };
    return { ok: true, link: links[i] };
  });
}

// Best-effort bookkeeping: called when a call starts through a link. Never
// throws — a vanished or invalid link just means nothing gets recorded.
export async function recordCallOnLink(token, conversationId) {
  try {
    if (!TOKEN_RE.test(String(token ?? ''))) return;
    await mutateLinks((links) => {
      const i = links.findIndex((l) => l.token === token);
      if (i === -1) return;
      const callIds = Array.isArray(links[i].callIds) ? links[i].callIds : [];
      if (callIds.includes(conversationId)) return;
      links[i] = { ...links[i], callIds: [...callIds, conversationId] };
    });
  } catch (e) {
    console.error('[loan] recordCallOnLink failed:', e);
  }
}

// Count a call attempt on a demo link *before* a token is minted, so the cap
// holds even if the browser never reports the call back. Atomic, so two quick
// requests can't both squeeze under the limit.
// -> { ok: true, link } | { ok: false, reason: 'not_found' | 'revoked' | 'expired' | 'limit' | 'busy' }
export async function reserveDemoSession(token, { now = Date.now() } = {}) {
  if (!TOKEN_RE.test(String(token ?? ''))) return { ok: false, reason: 'not_found' };
  return mutateLinks((links) => {
    const i = links.findIndex((l) => l.token === token);
    if (i === -1) return { ok: false, reason: 'not_found' };
    const link = links[i];
    const usable = isLinkUsable(link);
    if (!usable.ok) return usable;
    const used = Number(link.sessions) || 0;
    const max = Number(link.maxSessions) || DEFAULT_DEMO_SESSIONS;
    if (used >= max) return { ok: false, reason: 'limit' };
    const last = Date.parse(link.lastSessionAt || '') || 0;
    if (now - last < SESSION_GAP_MS) return { ok: false, reason: 'busy' };
    links[i] = { ...link, sessions: used + 1, lastSessionAt: new Date(now).toISOString() };
    return { ok: true, link: links[i] };
  });
}
