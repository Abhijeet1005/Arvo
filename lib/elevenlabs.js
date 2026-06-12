import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Server-side ElevenLabs client. The API key NEVER reaches the browser.
let client;

export function getElevenLabs() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set — add it to .env.local');
  }
  if (!client) {
    client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }
  return client;
}
