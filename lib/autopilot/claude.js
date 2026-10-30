// Calls to Claude for the autopilot: research, qualifying, writing, reading
// replies. One function, ask(), so every call is checked against the daily
// spend cap and its cost lands in the usage log.
//
// Configured with ANTHROPIC_API_KEY on the server. Server-only.
import Anthropic from '@anthropic-ai/sdk';
import { overBudget } from './model';
import { readState, mutate, addUsage, usageToday, logEvent } from './store';

export const MODEL = 'claude-opus-5-5';

// US dollars: per million tokens, and per web search. Used for the spend cap
// and the dashboard, so an estimate is enough; the Anthropic console has the
// exact bill.
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2, search: 0.01 };

export const claudeConfigured = () => Boolean(String(process.env.ANTHROPIC_API_KEY || '').trim());

export class BudgetError extends Error {
  constructor() {
    super('Today’s Claude spend cap is reached. The autopilot carries on tomorrow.');
    this.code = 'budget';
  }
}

export class ClaudeError extends Error {
  constructor(message, code = 'claude') {
    super(message);
    this.code = code;
  }
}

const g = globalThis;
function client() {
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) throw new ClaudeError('Set ANTHROPIC_API_KEY on the server.', 'config');
  if (g.__arvoClaude?.key !== key) g.__arvoClaude = { key, client: new Anthropic({ apiKey: key, maxRetries: 3 }) };
  return g.__arvoClaude.client;
}

export function costOf(usage = {}) {
  const m = 1_000_000;
  return (
    ((usage.input_tokens || 0) * PRICE.input) / m +
    ((usage.output_tokens || 0) * PRICE.output) / m +
    ((usage.cache_creation_input_tokens || 0) * PRICE.cacheWrite) / m +
    ((usage.cache_read_input_tokens || 0) * PRICE.cacheRead) / m +
    (usage.server_tool_use?.web_search_requests || 0) * PRICE.search
  );
}

// A long web-search turn can pause; it is resumed by sending the paused turn
// back. A few resumes is plenty for one research run.
const MAX_RESUMES = 4;

// Ask Claude one thing.
//   system, prompt   the instructions, and the request (with any website or
//                    email text inside it, marked as material to read)
//   schema           JSON schema: the answer comes back parsed as `data`
//   webSearch        allow up to this many web searches (0 = none)
//   webFetch         allow up to this many page fetches (0 = none). Fetches are
//                    made directly (not from code), so each page's text comes
//                    back in `pages` for the caller to check for itself.
//   effort           'low' | 'medium' | 'high'
// Returns { text, data, usd, pages: [{ url, text }] }. Throws BudgetError, or ClaudeError with a
// message safe to show on the dashboard.
export async function ask({ system, prompt, schema, webSearch = 0, webFetch = 0, effort = 'medium', maxTokens = 16000, label = 'claude' }) {
  const state = await readState();
  if (overBudget(state.settings, usageToday(state))) throw new BudgetError();

  const messages = [{ role: 'user', content: prompt }];
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    // If a safety check declines a harmless request, the API retries it on
    // another model instead of failing the step.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
  };
  const tools = [
    ...(webSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: webSearch }] : []),
    ...(webFetch ? [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: webFetch, max_content_tokens: 30000, allowed_callers: ['direct'] }] : []),
  ];
  if (tools.length) params.tools = tools;

  let usd = 0;
  let message;
  const pages = [];
  try {
    for (let i = 0; i <= MAX_RESUMES; i++) {
      message = await client().beta.messages.stream(params).finalMessage();
      usd += costOf(message.usage);
      pages.push(...fetchedPages(message.content));
      if (message.stop_reason !== 'pause_turn') break;
      params.messages = [...params.messages, { role: 'assistant', content: message.content }];
    }
  } catch (e) {
    throw new ClaudeError(friendly(e));
  } finally {
    if (usd > 0) await mutate((s) => addUsage(s, { usd })).catch(() => {});
  }

  if (message.stop_reason === 'refusal') {
    await mutate((s) => logEvent(s, `Claude declined a ${label} request.`, { kind: 'warning' })).catch(() => {});
    throw new ClaudeError('Claude declined this request.', 'refusal');
  }
  if (message.stop_reason === 'max_tokens') throw new ClaudeError('The answer was cut off (too long).');
  if (message.stop_reason === 'pause_turn') throw new ClaudeError('The research took too many steps. It will be tried again.');

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!schema) return { text, data: null, usd, pages };
  try {
    return { text, data: JSON.parse(text), usd, pages };
  } catch {
    throw new ClaudeError('The answer was not in the expected format.');
  }
}

// The pages web_fetch opened, as the tool returned them (not the model's
// reading of them).
function fetchedPages(content) {
  const out = [];
  for (const b of content || []) {
    if (b.type !== 'web_fetch_tool_result' || b.content?.type !== 'web_fetch_result') continue;
    const src = b.content.content?.source;
    if (src?.type === 'text' && src.data) out.push({ url: b.content.url, text: String(src.data) });
  }
  return out;
}

function friendly(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was refused. Check ANTHROPIC_API_KEY.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'The Anthropic API key is not allowed to do this.';
  if (e instanceof Anthropic.RateLimitError) return 'Claude is rate-limited right now. It will be tried again.';
  if (e instanceof Anthropic.BadRequestError) {
    console.error('[autopilot] Claude rejected a request:', e.message);
    return /credit|billing|balance/i.test(e.message) ? 'The Anthropic account is out of credit.' : 'Claude rejected the request (see the server log).';
  }
  if (e instanceof Anthropic.APIError) return `Claude is unavailable (${e.status ?? 'network'}). It will be tried again.`;
  if (e instanceof ClaudeError) return e.message;
  console.error('[autopilot] Claude call failed:', e);
  return 'Claude could not be reached. It will be tried again.';
}

// Text from a website or an email, wrapped so the model reads it as material
// rather than as instructions.
export function material(tag, content, max = 8000) {
  const body = String(content ?? '').replace(/<\/?(?:material|website|email)[^>]*>/gi, '').slice(0, max);
  return `<${tag}>\n${body}\n</${tag}>`;
}
