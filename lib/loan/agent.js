// The ElevenLabs agent behind the loan advisor.
//
// ElevenLabs agents are stored objects, so this module owns the full config
// and syncs it whenever settings change. Each ElevenLabs account (API key)
// gets its own agent; if the stored one has disappeared it is recreated.
import crypto from 'node:crypto';
import { elevenlabs, isAgentMissing } from './elevenlabs';
import { buildAgentPayload } from './payload';
import { apiKeyInfo, getAccountAgent, saveAccountAgent, getSettings } from './settings';

// The payload lives in ./payload.js (pure, so it can be checked without a
// server); re-exported so existing imports keep working.
export { buildAgentPayload };

function hashOf(payload) {
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

// Push `settings` to this account's agent, creating it if needed. Throws the
// ElevenLabs error if the config is rejected. Returns the agent id.
export async function syncAgent(settings, { force = false } = {}) {
  const { fingerprint } = await apiKeyInfo();
  const current = await getAccountAgent(fingerprint);
  const payload = buildAgentPayload(settings);
  const hash = hashOf(payload);

  if (current.agentId && current.agentHash === hash && !force) return current.agentId;

  if (current.agentId) {
    try {
      await elevenlabs(`/v1/convai/agents/${encodeURIComponent(current.agentId)}`, { method: 'PATCH', body: payload });
      await saveAccountAgent(fingerprint, { agentId: current.agentId, agentHash: hash });
      return current.agentId;
    } catch (e) {
      if (!isAgentMissing(e)) throw e;
      // Deleted remotely: fall through and create a fresh one.
    }
  }

  const created = await elevenlabs('/v1/convai/agents/create', { method: 'POST', body: payload });
  if (!created.agent_id) throw new Error('ElevenLabs did not return an agent id.');
  await saveAccountAgent(fingerprint, { agentId: created.agent_id, agentHash: hash });
  return created.agent_id;
}

export async function ensureLoanAgent() {
  return syncAgent(await getSettings());
}

// The agent id for the current account, if one has been created.
export async function currentAgentId() {
  const { fingerprint } = await apiKeyInfo();
  return (await getAccountAgent(fingerprint)).agentId || null;
}

// A short-lived WebRTC token the browser uses to join a call with the agent.
export async function mintLoanToken() {
  const agentId = await ensureLoanAgent();
  try {
    const { token } = await elevenlabs('/v1/convai/conversation/token', { query: { agent_id: agentId } });
    return { agentId, token };
  } catch (e) {
    if (!isAgentMissing(e)) throw e;
    // The agent vanished since the last sync: rebuild once.
    const { fingerprint } = await apiKeyInfo();
    await saveAccountAgent(fingerprint, null);
    const fresh = await ensureLoanAgent();
    const { token } = await elevenlabs('/v1/convai/conversation/token', { query: { agent_id: fresh } });
    return { agentId: fresh, token };
  }
}
