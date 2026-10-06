// Share links for the loan advisor, stored under `loanLinks` in .agent.json.
//
// A share link is a token an operator hands to one customer so they can open
// a public, branded page and start (or watch) a call themselves — the "send
// this to a prospective client" mechanic. Deliberately dumb about the agent
// itself: a link only ever points at whatever the *current* live settings
// and agent are at call time (see lib/loan/agent.js) — it never freezes a
// snapshot of the config from when it was created.
//
// Pure-ish module like lib/loan/settings.js: storage + validation only, no
// ElevenLabs calls here.
import crypto from 'node:crypto';
import { readStore, writeStore } from '@/lib/store';

const KEY = 'loanLinks';
const MAX_LINKS = 500;

// base64url of 16 random bytes is always 22 chars from [A-Za-z0-9_-], no
// padding — sliced defensively in case that ever changes.
const TOKEN_LENGTH = 22;
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,24}$/;

// expiresInDays convention used by createShareLink: undefined -> default
// (7 days), null -> never expires, a number -> clamped to 1-30 days.
const DEFAULT_EXPIRES_DAYS = 7;
const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 30;

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

async function writeLinks(links) {
  await writeStore({ [KEY]: links.slice(0, MAX_LINKS) });
}

// Create a link for one customer. Throws a plain Error with a display-ready
// message if customerName is blank after sanitising — callers should surface
// that as a 400.
export async function createShareLink({ customerName, customerPhone, note, expiresInDays } = {}) {
  const name = clean(customerName, 40);
  if (!name) throw new Error('A customer name is required.');

  const link = {
    token: generateToken(),
    customerName: name,
    customerPhone: clean(customerPhone, 20),
    note: cleanNote(note),
    createdAt: new Date().toISOString(),
    expiresAt: expiryFrom(expiresInDays),
    revoked: false,
    callIds: [],
  };

  const links = await readLinks();
  links.unshift(link);
  await writeLinks(links);
  return link;
}

// Newest first (new links are unshifted in, same as lib/loan/calls.js).
export async function listShareLinks() {
  return readLinks();
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
  const links = await readLinks();
  const i = links.findIndex((l) => l.token === token);
  if (i === -1) return null;
  if (!links[i].revoked) {
    links[i] = { ...links[i], revoked: true };
    await writeLinks(links);
  }
  return links[i];
}

// Best-effort bookkeeping: called when a call starts through a link. Never
// throws — a vanished or invalid link just means nothing gets recorded.
export async function recordCallOnLink(token, conversationId) {
  try {
    if (!TOKEN_RE.test(String(token ?? ''))) return;
    const links = await readLinks();
    const i = links.findIndex((l) => l.token === token);
    if (i === -1) return;
    const callIds = Array.isArray(links[i].callIds) ? links[i].callIds : [];
    if (callIds.includes(conversationId)) return;
    links[i] = { ...links[i], callIds: [...callIds, conversationId] };
    await writeLinks(links);
  } catch (e) {
    console.error('[loan] recordCallOnLink failed:', e);
  }
}
