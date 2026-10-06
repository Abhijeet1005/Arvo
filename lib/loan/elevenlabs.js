// Minimal ElevenLabs REST client for the loan agent.
//
// Talks to the documented snake_case REST API directly rather than through
// the JS SDK, so every payload here reads 1:1 with ElevenLabs' API reference.
// Server-only: the API key never reaches the browser.
import { apiKeyInfo } from './settings';

const BASE = 'https://api.elevenlabs.io';

export class ElevenLabsApiError extends Error {
  constructor(status, body) {
    super(messageFrom(status, body));
    this.name = 'ElevenLabsApiError';
    this.status = status;
    const d = body?.detail;
    const obj = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    this.code = obj.code || '';
    this.statusCode = obj.status || '';
  }
}

function messageFrom(status, body) {
  const d = body?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    // FastAPI-style validation errors: [{ loc: [...], msg }]
    return d.map((x) => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join('; ');
  }
  return d?.message || body?.message || `ElevenLabs request failed (${status}).`;
}

// opts.apiKey overrides the configured key (used to validate a new key).
export async function elevenlabs(path, { method = 'GET', body, query, apiKey, timeoutMs = 30000 } = {}) {
  const key = apiKey || (await apiKeyInfo()).key;
  if (!key) {
    throw new ElevenLabsApiError(401, {
      detail: { code: 'no_api_key', message: 'No ElevenLabs API key is set.' },
    });
  }

  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method,
    headers: { 'xi-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: { message: text.slice(0, 200) } };
  }
  if (!res.ok) throw new ElevenLabsApiError(res.status, data);
  return data;
}

const is = (e) => e instanceof ElevenLabsApiError;

// The stored agent no longer exists on this account (deleted, or the key now
// points at a different account).
export function isAgentMissing(e) {
  return is(e) && e.status === 404 && /agent_not_found|document_not_found/.test(`${e.code} ${e.statusCode}`);
}

export function isVoiceMissing(e) {
  return is(e) && /voice_not_found/.test(`${e.code} ${e.statusCode}`);
}

export function isConversationMissing(e) {
  return is(e) && e.status === 404 && /conversation/.test(`${e.code} ${e.statusCode}`);
}

// A 4xx that means ElevenLabs rejected the request itself (as opposed to a
// network blip or an outage), so retrying with the same input won't help.
export function isRejected(e) {
  return is(e) && e.status >= 400 && e.status < 500 && e.status !== 429;
}

// Turn provider errors into something an operator can act on.
export function friendlyError(e) {
  if (is(e)) {
    const tag = `${e.code} ${e.statusCode}`;
    if (e.code === 'no_api_key') {
      return 'No ElevenLabs API key is set. Add one under Configuration → ElevenLabs account.';
    }
    if (isVoiceMissing(e)) {
      return "That voice isn't in this ElevenLabs account's library. Pick one of your voices, or add it from the voice library.";
    }
    if (/quota/.test(tag) || /quota/i.test(e.message)) {
      return 'This ElevenLabs key is out of credits. Paste a fresh key under Configuration → ElevenLabs account.';
    }
    if (/voice_limit|voice_add_edit|too_many_voices/.test(tag) || /voice (slot|limit)/i.test(e.message)) {
      return "This ElevenLabs account can't add more voices. Remove one on elevenlabs.io, or pick a voice you already have.";
    }
    if (e.status === 401) {
      return 'ElevenLabs rejected the API key. Paste a valid key under Configuration → ElevenLabs account.';
    }
    if (e.status === 429) {
      return 'ElevenLabs is busy (too many requests on this key). Wait a moment and try again.';
    }
    return `ElevenLabs: ${e.message}`;
  }
  if (e?.name === 'TimeoutError') return 'ElevenLabs took too long to respond. Please try again.';
  return String(e?.message || e);
}
