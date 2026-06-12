import { NextResponse } from 'next/server';
import { readStore, writeStore, getAgentId } from '@/lib/store';
import { syncAgent } from '@/lib/agent';

export const dynamic = 'force-dynamic';

// Return the current agent id + saved config so the dashboard can hydrate.
export async function GET() {
  const store = await readStore();
  const agentId = await getAgentId();
  return NextResponse.json({ agentId, config: store.config || null });
}

// Save config and create/update the ElevenLabs agent.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { name, prompt, firstMessage, voiceId, language, llm } = body;

  await writeStore({ config: { name, prompt, firstMessage, voiceId, language, llm } });

  try {
    const agentId = await syncAgent();
    return NextResponse.json({ ok: true, agentId });
  } catch (e) {
    console.error('[agent] save failed:', e);
    return NextResponse.json({ error: 'Could not save the agent. Please try again.' }, { status: 500 });
  }
}
