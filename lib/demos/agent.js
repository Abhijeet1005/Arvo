// The ElevenLabs side of a demo: one agent per demo, created and kept in sync
// on the server. The browser never sends a prompt or an agent id, so a public
// demo link can only ever start the agent it was made for.
//
// All demo agents share one workspace tool (update_progress), so dozens of
// demos don't each add a copy of it to the account.
import crypto from 'node:crypto';
import { readStore, updateStore } from '@/lib/store';
import { elevenlabs, isAgentMissing, ElevenLabsApiError } from '@/lib/loan/elevenlabs';
import { apiKeyInfo, getSettings } from '@/lib/loan/settings';
import { listLlms, normaliseLlm, listAccountVoices } from '@/lib/loan/catalog';
import { buildAgentPayload } from '@/lib/loan/payload';
import { progressToolSpec } from '@/lib/loan/progress';
import { getDemo, patchDemo } from './store';
import { demoSettings } from './model';
import { analysisFor, keywordsFor, endCallDescriptionFor } from './templates';

// Guard rails on the account's credits: a public link can only spend so much.
export const DEMO_CALL_LIMITS = { agent_concurrency_limit: 3, daily_limit: 20, bursting_enabled: false };

const sha1 = (value) => crypto.createHash('sha1').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const enc = encodeURIComponent;

// ------------------------------------------------------------------ locks

// One Node process serves the app, so a promise chain per key is enough. It
// lives on globalThis because route bundles can each load their own copy of
// this module.
const g = globalThis;
g.__arvoLocks ||= new Map();

function withLock(key, task) {
  const previous = g.__arvoLocks.get(key) || Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.then(() => undefined, () => undefined);
  g.__arvoLocks.set(key, tail);
  tail.then(() => {
    if (g.__arvoLocks.get(key) === tail) g.__arvoLocks.delete(key);
  });
  return run;
}

const isNotFound = (e) => e instanceof ElevenLabsApiError && e.status === 404;

// ------------------------------------------------------- shared progress tool

function progressSpec() {
  // Silent bookkeeping for the live checklist: never speak before it.
  return { ...progressToolSpec(), pre_tool_speech: 'off' };
}

async function savedTool(fingerprint) {
  const store = await readStore();
  return store.loan?.sharedTools?.[fingerprint] || null;
}

async function saveTool(fingerprint, value) {
  await updateStore((store) => {
    const loan = { ...(store.loan || {}) };
    loan.sharedTools = { ...(loan.sharedTools || {}), [fingerprint]: value };
    return { ...store, loan };
  });
}

// The workspace tool every demo agent points at. Checked against ElevenLabs,
// so it is re-created if someone deleted it, and updated if its definition
// changed in a newer version of the app.
export function ensureProgressTool() {
  return withLock('progress-tool', async () => {
    const { fingerprint } = await apiKeyInfo();
    const spec = progressSpec();
    const specHash = sha1(spec);
    const saved = await savedTool(fingerprint);

    if (saved?.progressToolId) {
      try {
        await elevenlabs(`/v1/convai/tools/${enc(saved.progressToolId)}`);
        if (saved.specHash !== specHash) {
          await elevenlabs(`/v1/convai/tools/${enc(saved.progressToolId)}`, { method: 'PATCH', body: { tool_config: spec } });
          await saveTool(fingerprint, { progressToolId: saved.progressToolId, specHash });
        }
        return saved.progressToolId;
      } catch (e) {
        if (!isNotFound(e)) throw e;
        // Deleted remotely: create it again below.
      }
    }

    const created = await elevenlabs('/v1/convai/tools', { method: 'POST', body: { tool_config: spec } });
    if (!created.id) throw new Error('ElevenLabs did not return a tool id.');
    await saveTool(fingerprint, { progressToolId: created.id, specHash });
    return created.id;
  });
}

// ------------------------------------------------------------ settings & voice

// The operator's own agent settings (model, voice model, pace, call behaviour)
// are the starting point for every demo, with a reasoning level the model
// supports.
async function operatorBase() {
  const settings = await getSettings();
  let list = null;
  try {
    list = await listLlms();
  } catch {
    // Model list unavailable: ElevenLabs still validates on sync.
  }
  if (!list) return settings;
  const checked = normaliseLlm(settings, list);
  if (checked.error) throw new Error(checked.error);
  return checked.settings;
}

g.__arvoVoiceCache ||= new Map();

async function accountVoices(fingerprint) {
  const hit = g.__arvoVoiceCache.get(fingerprint);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.list;
  let list = [];
  try {
    list = await listAccountVoices();
  } catch {
    // Best effort: without the list the operator's own voice is used.
  }
  g.__arvoVoiceCache.set(fingerprint, { at: Date.now(), list });
  return list;
}

// A Hindi demo with no chosen voice should still sound like its persona. If the
// persona's gender differs from the operator's own agent, look for an account
// voice of that gender (Hindi-capable first). Empty means "use the default".
async function voiceFallbackFor(demo, base, fingerprint) {
  const a = demo.agent;
  if (a.voiceId || a.language !== 'hi' || a.gender === base.agentGender) return '';
  const voices = await accountVoices(fingerprint);
  const want = a.gender;
  const same = (v) => String(v.gender || '').toLowerCase() === want;
  return (voices.find((v) => v.hindi && same(v)) || voices.find(same))?.id || '';
}

function agentNameFor(demo) {
  return `${demo.business.name} · Demo (${demo.agent.name})`.slice(0, 100);
}

async function payloadFor(demo, toolId, fingerprint) {
  const base = await operatorBase();
  const settings = demoSettings(demo, base, { voiceFallback: await voiceFallbackFor(demo, base, fingerprint) });
  return buildAgentPayload(settings, {
    analysis: analysisFor(demo.templateId, demo.industry, demo),
    progressToolId: toolId,
    name: agentNameFor(demo),
    endCallDescription: endCallDescriptionFor(demo.templateId),
    callLimits: DEMO_CALL_LIMITS,
    keywords: keywordsFor(demo) || undefined,
  });
}

// ------------------------------------------------------------------- agent

// Make the demo's ElevenLabs agent match the demo, creating it if needed.
// Cheap when nothing changed (no network call). Throws the ElevenLabs error if
// the config is rejected. Returns the agent id.
export function syncDemoAgent(demoId, { force = false } = {}) {
  return withLock(`demo:${demoId}`, () => sync(demoId, force));
}

async function sync(demoId, force) {
  const demo = await getDemo(demoId);
  if (!demo) throw new Error('This demo no longer exists.');
  const { fingerprint } = await apiKeyInfo();

  // An agent made with another API key lives in another account: it can
  // neither be updated nor deleted from here.
  const hasAgent = Boolean(demo.agentId) && demo.agentFp === fingerprint;

  let toolId = (await savedTool(fingerprint))?.progressToolId || '';
  let payload = toolId ? await payloadFor(demo, toolId, fingerprint) : null;
  let hash = payload ? sha1(payload) : '';
  if (hasAgent && payload && hash === demo.agentHash && !force) return demo.agentId;

  // Something changed (or there is no agent yet): confirm the shared tool still
  // exists before pointing an agent at it.
  const checkedToolId = await ensureProgressTool();
  if (checkedToolId !== toolId || !payload) {
    toolId = checkedToolId;
    payload = await payloadFor(demo, toolId, fingerprint);
    hash = sha1(payload);
  }

  if (hasAgent) {
    try {
      await elevenlabs(`/v1/convai/agents/${enc(demo.agentId)}`, { method: 'PATCH', body: payload });
      await patchDemo(demoId, { agentHash: hash, agentFp: fingerprint });
      return demo.agentId;
    } catch (e) {
      if (!isAgentMissing(e)) throw e;
      // Deleted remotely: fall through and create a fresh one.
    }
  }

  const created = await elevenlabs('/v1/convai/agents/create', { method: 'POST', body: payload });
  if (!created.agent_id) throw new Error('ElevenLabs did not return an agent id.');
  const saved = await patchDemo(demoId, { agentId: created.agent_id, agentHash: hash, agentFp: fingerprint });
  if (!saved) {
    // The demo was deleted while its agent was being created: don't leave it behind.
    await elevenlabs(`/v1/convai/agents/${enc(created.agent_id)}`, { method: 'DELETE' }).catch(() => {});
    throw new Error('This demo no longer exists.');
  }
  return created.agent_id;
}

// Delete the demo's agent from ElevenLabs. A missing agent counts as removed.
export async function removeDemoAgent(demo) {
  if (!demo?.agentId) return { removed: false, reason: 'no_agent' };
  const { fingerprint } = await apiKeyInfo();
  if (demo.agentFp && demo.agentFp !== fingerprint) return { removed: false, reason: 'other_account' };
  try {
    await elevenlabs(`/v1/convai/agents/${enc(demo.agentId)}`, { method: 'DELETE' });
  } catch (e) {
    if (!isAgentMissing(e) && !isNotFound(e)) throw e;
  }
  return { removed: true };
}

// A short-lived WebRTC token the visitor's browser uses to join this demo's
// agent. Syncs first, so the call always runs the demo as it is now.
export async function mintDemoToken(demoId) {
  const agentId = await syncDemoAgent(demoId);
  try {
    const { token } = await elevenlabs('/v1/convai/conversation/token', { query: { agent_id: agentId } });
    return { agentId, token };
  } catch (e) {
    if (!isAgentMissing(e)) throw e;
    // The agent vanished since the last sync: rebuild it once.
    const fresh = await syncDemoAgent(demoId, { force: true });
    const { token } = await elevenlabs('/v1/convai/conversation/token', { query: { agent_id: fresh } });
    return { agentId: fresh, token };
  }
}
