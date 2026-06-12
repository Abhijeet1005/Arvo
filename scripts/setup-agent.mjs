// One-shot: push a known-good config to the ElevenLabs agent (create or update).
// Run:  node --env-file=.env.local scripts/setup-agent.mjs
//
// Use this to (re)seed the demo agent or fix a broken config. It mirrors what
// the dashboard does, but from the command line.

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { readFileSync, writeFileSync } from 'node:fs';

const STORE = new URL('../.agent.json', import.meta.url);

const PROMPT = [
  'You are a friendly voice support agent. At the start of the call, greet the caller and clearly state you are an AI assistant.',
  '',
  'LANGUAGE STEP: Right after greeting, ask whether the caller would like to continue in English or in Hinglish. Once they answer, use ONLY that choice for the rest of the conversation — clear, simple English if they choose English, or natural Hinglish (a casual mix of Hindi and English, the way people speak in urban India) if they choose Hinglish. Keep the same language for the entire call; do not switch unless the caller explicitly asks. If their choice is unclear, ask once more.',
  '',
  'Answer questions using your knowledge base. Keep replies short and conversational — one or two sentences. Never invent order details, prices, or dates. If you cannot help, offer to take a message or transfer to a human.',
].join('\n');

const config = {
  name: 'Support Agent',
  prompt: PROMPT,
  firstMessage: 'Namaste! This is the AI support assistant. Would you like to continue in English, or in Hinglish?',
  language: 'hi',
  // Known-good default voice. Swap for a Hindi voice once it's added to "My Voices".
  voiceId: process.env.AGENT_VOICE_ID || 'cjVigY5qzO86Huf0OWal',
  llm: 'gemini-2.5-flash',
};

function readStore() {
  try { return JSON.parse(readFileSync(STORE, 'utf8')); } catch { return {}; }
}

const store = readStore();

const conversationConfig = {
  agent: {
    firstMessage: config.firstMessage,
    language: config.language,
    prompt: {
      prompt: config.prompt,
      llm: config.llm,
      temperature: 0.3,
      knowledgeBase: store.knowledgeBase || [],
      toolIds: store.toolIds || [],
    },
  },
  tts: {
    voiceId: config.voiceId,
    modelId: 'eleven_flash_v2_5',
  },
};

const el = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

let agentId = store.agentId;
if (agentId) {
  await el.conversationalAi.agents.update(agentId, { name: config.name, conversationConfig });
  console.log('✓ Updated agent', agentId);
} else {
  const created = await el.conversationalAi.agents.create({ name: config.name, conversationConfig });
  agentId = created.agentId || created.agent_id;
  console.log('✓ Created agent', agentId);
}

writeFileSync(STORE, JSON.stringify({ ...store, agentId, config }, null, 2));
console.log('✓ Saved .agent.json');
console.log('  voice:', config.voiceId, '| language:', config.language, '| model: eleven_flash_v2_5');
console.log('  knowledge:', (store.knowledgeBase || []).map((k) => k.name).join(', ') || 'none');
