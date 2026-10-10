import { NextResponse } from 'next/server';
import { getShareLink, TOKEN_RE } from '@/lib/loan/shareLinks';
import { CONVERSATION_ID_RE } from '@/lib/loan/calls';
import { refreshDemoCall } from '@/lib/demos/calls';
import { publicResult } from '@/lib/demos/model';

export const dynamic = 'force-dynamic';

// PUBLIC route — a visitor on a demo link asks what the agent captured on
// their own call (?call=<conversation id>). Answers only for a call that was
// registered on this very link, and only with the lead card, never the
// transcript, audit checks or anything about other calls.
export async function GET(req, { params }) {
  const { token } = await params;
  const callId = new URL(req.url).searchParams.get('call') || '';
  if (!TOKEN_RE.test(token) || !CONVERSATION_ID_RE.test(callId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const link = await getShareLink(token);
  if (!link?.demoId || !Array.isArray(link.callIds) || !link.callIds.includes(callId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const call = await refreshDemoCall(callId);
    if (!call || call.demoId !== link.demoId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    const status = call.status === 'done' || call.status === 'failed' ? call.status : 'pending';
    return NextResponse.json({ status, result: status === 'done' ? publicResult(call) : null });
  } catch (e) {
    console.error('[demos] result lookup failed:', e?.message || e);
    // Not an error the visitor can act on: they keep waiting or give up.
    return NextResponse.json({ status: 'pending', result: null });
  }
}
