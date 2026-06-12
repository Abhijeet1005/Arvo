import { NextResponse } from 'next/server';
import { getElevenLabs } from '@/lib/elevenlabs';
import { getAgentId } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Mint a short-lived WebRTC token so the browser can talk to the agent
// WITHOUT ever seeing the API key. This is the white-label entry point.
export async function GET() {
  const agentId = await getAgentId();
  if (!agentId) {
    return NextResponse.json({ error: 'No agent yet — create it in step 1.' }, { status: 400 });
  }

  try {
    const el = getElevenLabs();
    const res = await el.conversationalAi.conversations.getWebrtcToken({ agentId });
    const token = res.token || res.conversationToken || res.conversation_token;
    return NextResponse.json({ token });
  } catch (e) {
    console.error('[webrtc-token] failed:', e);
    return NextResponse.json({ error: 'Could not start the conversation. Please try again.' }, { status: 500 });
  }
}
