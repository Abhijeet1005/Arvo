// The ElevenLabs agent behind the loan advisor.
//
// ElevenLabs agents are stored objects, so this module owns the full config
// and syncs it whenever settings change. Each ElevenLabs account (API key)
// gets its own agent; if the stored one has disappeared it is recreated.
import crypto from 'node:crypto';
import { elevenlabs, isAgentMissing } from './elevenlabs';
import { resolvedPrompt, resolvedFirstMessage } from './prompt';
import { DATA_COLLECTION, EVALUATION_CRITERIA } from './analysis';
import { ttsModelFor } from './options';
import { apiKeyInfo, getAccountAgent, saveAccountAgent, getSettings } from './settings';
import { progressToolSpec } from './progress';

export function buildAgentPayload(s) {
  const language = s.language === 'en' ? 'en' : 'hi';
  return {
    name: `${s.companyName} · Loan advisor (${s.agentName})`,
    conversation_config: {
      agent: {
        first_message: resolvedFirstMessage(s),
        language,
        // With language 'hi', ElevenLabs answers in natural Hindi-English mix.
        hinglish_mode: language === 'hi' && s.hinglishMode,
        // Filled in per call from the dashboard; these only apply when testing
        // inside the ElevenLabs console.
        dynamic_variables: {
          dynamic_variable_placeholders: { customer_name: 'Rahul', customer_phone: 'not on file' },
        },
        prompt: {
          prompt: resolvedPrompt(s),
          llm: s.llm,
          // null clears it: ElevenLabs rejects reasoning for models without it.
          reasoning_effort: s.reasoningEffort || null,
          temperature: s.temperature,
          built_in_tools: {
            end_call: {
              type: 'system',
              name: 'end_call',
              description:
                'Hang up. Only call this in the same turn as a spoken final line (the closing "Thank you ... आपका दिन अच्छा रहे." or the do-not-call acknowledgement). Never call it right after the customer answers a question, and never without speaking first.',
              params: { system_tool_type: 'end_call' },
            },
          },
          // update_progress: a silent client tool so a live "what's happening
          // now" checklist can be shown to whoever is on the call (operator
          // demo widget or a client's public share link). Purely cosmetic —
          // never spoken about, never blocks the conversation.
          tools: [progressToolSpec()],
        },
      },
      tts: {
        model_id: ttsModelFor(language, s.ttsModel),
        voice_id: s.voiceId,
        speed: s.speed,
        stability: s.stability,
        similarity_boost: s.similarityBoost,
      },
      turn: {
        // Re-engage after this much silence ("Hello, मेरी आवाज़ आ रही है?").
        turn_timeout: s.turnTimeout,
        turn_eagerness: s.turnEagerness,
        silence_end_call_timeout: s.silenceHangup > 0 ? s.silenceHangup : -1,
        // Wait patiently while someone spells out a PAN or phone number.
        spelling_patience: 'auto',
      },
      // Hard cap so a forgotten demo call can't drain a test key.
      conversation: { max_duration_seconds: s.maxCallMinutes * 60 },
    },
    platform_settings: {
      data_collection: DATA_COLLECTION,
      evaluation: { criteria: EVALUATION_CRITERIA },
      summary_language: 'en',
    },
  };
}

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
