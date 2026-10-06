import { NextResponse } from 'next/server';
import { mintLoanToken } from '@/lib/loan/agent';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Start a call: make sure the agent is in sync, then mint a short-lived
// WebRTC token for the browser. The API key never leaves the server.
export async function POST() {
  try {
    const { agentId, token } = await mintLoanToken();
    return NextResponse.json({ agentId, conversationToken: token });
  } catch (e) {
    console.error('[loan] session failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }
}
