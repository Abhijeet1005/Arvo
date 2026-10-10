// Call log for the loan advisor, stored under `loanCalls` in .agent.json.
//
// A call is registered when the browser connects, then refreshed from
// ElevenLabs until post-call analysis has produced the END-OF-CALL OUTPUT.
import { readStore, updateStore } from '@/lib/store';
import { elevenlabs, isConversationMissing } from './elevenlabs';
import { resultFromConversation, callMetaFromConversation } from './analysis';
import { mapResult, mapMeta } from '@/lib/demos/templates';

// A conversation that still can't be found this long after it started won't
// appear (e.g. the API key was switched to another account mid-analysis).
const GIVE_UP_AFTER_MS = 15 * 60 * 1000;

const KEY = 'loanCalls';
// Demo links bring many more calls than hand-run rehearsals did.
const MAX_CALLS = 1000;

export const CONVERSATION_ID_RE = /^conv_[a-z0-9]{8,64}$/i;

export async function listCalls() {
  const store = await readStore();
  return Array.isArray(store[KEY]) ? store[KEY] : [];
}

export async function getCall(id) {
  return (await listCalls()).find((c) => c.id === id) || null;
}

export async function upsertCall(id, patch) {
  let call;
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? [...store[KEY]] : [];
    const now = new Date().toISOString();
    const i = list.findIndex((c) => c.id === id);
    if (i === -1) {
      call = { id, createdAt: now, ...patch, updatedAt: now };
      list.unshift(call);
    } else {
      call = { ...list[i], ...patch, updatedAt: now };
      list[i] = call;
    }
    return { ...store, [KEY]: list.slice(0, MAX_CALLS) };
  });
  return call;
}

export async function removeCall(id) {
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? store[KEY] : [];
    return { ...store, [KEY]: list.filter((c) => c.id !== id) };
  });
}

// Drop every call that belongs to a demo (used when the demo is deleted).
export async function removeCallsForDemo(demoId) {
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? store[KEY] : [];
    if (!list.some((c) => c.demoId === demoId)) return;
    return { ...store, [KEY]: list.filter((c) => c.demoId !== demoId) };
  });
}

// Set a flag on a call exactly once, however many requests race for it.
// True for the caller that set it, false for everyone else.
export async function claimCallFlag(id, flag) {
  let claimed = false;
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? [...store[KEY]] : [];
    const i = list.findIndex((c) => c.id === id);
    if (i === -1 || list[i][flag]) return;
    list[i] = { ...list[i], [flag]: true };
    claimed = true;
    return { ...store, [KEY]: list };
  });
  return claimed;
}

export const FINAL_STATUSES = new Set(['done', 'failed']);

// What a finished conversation turns into. Demo calls carry their template, so
// the result is read the way that template asked for it; every other call is a
// loan-advisor call, exactly as before.
function outcomeOf(call, conv) {
  if (call.demoId) {
    return { result: mapResult(call.templateId, call.industry, conv, call.customerName), ...mapMeta(call.templateId, conv) };
  }
  return { result: resultFromConversation(conv, call.customerName), ...callMetaFromConversation(conv) };
}

function metaOf(call, conv) {
  return call.demoId ? mapMeta(call.templateId, conv) : callMetaFromConversation(conv);
}

// Pull the latest state of a call from ElevenLabs. Cheap to call repeatedly:
// finished calls are returned from the local log without a network hop.
export async function refreshCall(id) {
  const call = await getCall(id);
  if (!call || FINAL_STATUSES.has(call.status)) return call;

  let conv;
  try {
    conv = await elevenlabs(`/v1/convai/conversations/${encodeURIComponent(id)}`);
  } catch (e) {
    if (!isConversationMissing(e)) throw e;
    const age = Date.now() - Date.parse(call.startedAt || call.createdAt || 0);
    if (age > GIVE_UP_AFTER_MS) {
      return upsertCall(id, {
        status: 'failed',
        error: 'This call is not on the current ElevenLabs account (was the API key changed?).',
      });
    }
    // Not visible yet right after connecting — keep waiting.
    return call;
  }

  // Only ever expose conversations that belong to the loan agent.
  if (call.agentId && conv.agent_id && conv.agent_id !== call.agentId) {
    return upsertCall(id, { status: 'failed', error: 'This conversation belongs to a different agent.' });
  }

  if (conv.status === 'done') {
    return upsertCall(id, { status: 'done', ...outcomeOf(call, conv) });
  }
  if (conv.status === 'failed') {
    return upsertCall(id, { status: 'failed', error: 'ElevenLabs could not process this call.', ...metaOf(call, conv) });
  }

  const status = conv.status === 'processing' ? 'processing' : 'in_progress';
  return status === call.status ? call : upsertCall(id, { status });
}
