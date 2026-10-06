import { NextResponse } from 'next/server';
import { upsertCall, CONVERSATION_ID_RE } from '@/lib/loan/calls';
import { currentAgentId } from '@/lib/loan/agent';
import { recordCallOnLink, TOKEN_RE } from '@/lib/loan/shareLinks';

export const dynamic = 'force-dynamic';

// Register a call as soon as the browser connects, so it shows up in the log
// and can be refreshed once ElevenLabs finishes the post-call analysis. This
// is the single call-registration path for both operator demo calls and
// public share-link calls — the only difference is an optional linkToken.
// Body: { conversationId, customerName, linkToken? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.conversationId || '').trim();
  if (!CONVERSATION_ID_RE.test(id)) {
    return NextResponse.json({ error: 'A valid conversationId is required.' }, { status: 400 });
  }
  const customerName = String(body.customerName || '')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  const call = await upsertCall(id, {
    customerName,
    agentId: await currentAgentId(),
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  });

  const linkToken = String(body.linkToken || '').trim();
  if (TOKEN_RE.test(linkToken)) {
    await recordCallOnLink(linkToken, id);
  }

  return NextResponse.json({ call });
}
