import { NextResponse } from 'next/server';
import { upsertCall, CONVERSATION_ID_RE } from '@/lib/loan/calls';
import { currentAgentId } from '@/lib/loan/agent';
import { getShareLink, recordCallOnLink, TOKEN_RE } from '@/lib/loan/shareLinks';
import { registerDemoCall } from '@/lib/demos/calls';

export const dynamic = 'force-dynamic';

const cleanName = (value) =>
  String(value || '')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

// Register a call as soon as the browser connects, so it shows up in the log
// and can be refreshed once ElevenLabs finishes the post-call analysis. This
// is the single call-registration path for operator demo calls, public
// share-link calls and demo-link calls — the only difference is an optional
// linkToken.
// Body: { conversationId, customerName, linkToken? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.conversationId || '').trim();
  if (!CONVERSATION_ID_RE.test(id)) {
    return NextResponse.json({ error: 'A valid conversationId is required.' }, { status: 400 });
  }
  const customerName = cleanName(body.customerName);

  const linkToken = String(body.linkToken || '').trim();
  const link = TOKEN_RE.test(linkToken) ? await getShareLink(linkToken) : null;

  // A demo link: the call belongs to that demo's own agent, and the link must
  // have started it (see claimDemoCall). Nothing about the call is returned.
  if (link?.demoId) {
    const registered = await registerDemoCall({ link, conversationId: id, callerName: customerName });
    if (!registered.ok) return NextResponse.json({ error: registered.error }, { status: registered.status });
    return NextResponse.json({ ok: true });
  }

  const call = await upsertCall(id, {
    customerName,
    agentId: await currentAgentId(),
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  });

  if (link) await recordCallOnLink(linkToken, id);

  return NextResponse.json({ call });
}
