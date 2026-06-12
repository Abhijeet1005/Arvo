import { getElevenLabs } from '@/lib/elevenlabs';
import { readStore, writeStore, getAgentId } from '@/lib/store';
import { syncTools } from '@/lib/tools';

// Build the ElevenLabs conversation_config from OUR stored values.
// We always send a clean camelCase shape, so we never depend on reading
// back the API's snake_case responses.
export function buildConversationConfig(store) {
  const c = store.config || {};
  return {
    agent: {
      firstMessage: c.firstMessage || '',
      language: c.language || 'en',
      prompt: {
        prompt: c.prompt || '',
        llm: c.llm || 'gemini-2.5-flash',
        temperature: 0.3,
        knowledgeBase: store.knowledgeBase || [],
        toolIds: Object.values(store.tools || {}),
      },
    },
    tts: {
      voiceId: c.voiceId || 'cjVigY5qzO86Huf0OWal',
      // Flash v2.5 is low-latency and multilingual (Hindi/Hinglish/English).
      // Required for non-English agents, and a good default for voice anyway.
      modelId: c.modelId || 'eleven_flash_v2_5',
    },
  };
}

// Create the agent if it doesn't exist yet, else update it. Returns the id.
export async function syncAgent() {
  const el = getElevenLabs();
  // Make sure the webhook tools exist (and toolIds are stored) before we
  // build the agent config. No-op until APP_URL is a public URL.
  await syncTools(el);
  const store = await readStore();
  const conversationConfig = buildConversationConfig(store);
  const name = store.config?.name || 'Support Agent';

  let agentId = await getAgentId();
  if (agentId) {
    await el.conversationalAi.agents.update(agentId, { name, conversationConfig });
  } else {
    const created = await el.conversationalAi.agents.create({ name, conversationConfig });
    agentId = created.agentId || created.agent_id;
    await writeStore({ agentId });
  }
  return agentId;
}
