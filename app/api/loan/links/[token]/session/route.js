import { NextResponse } from 'next/server';
import { getShareLink, isLinkUsable, TOKEN_RE } from '@/lib/loan/shareLinks';
import { mintLoanToken } from '@/lib/loan/agent';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// PUBLIC route — starts a call for a client on a share link. Mirrors
// app/api/loan/session/route.js, gated on the link still being usable.
// Dynamic variables (customer name/phone) are sourced client-side from the
// public GET route above, same as the operator demo call does from its form.
export async function POST(_req, { params }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 400 });
  }

  const link = await getShareLink(token);
  if (!link) {
    return NextResponse.json({ error: 'This link was not found.' }, { status: 404 });
  }

  const usable = isLinkUsable(link);
  if (!usable.ok) {
    const error =
      usable.reason === 'revoked'
        ? 'This link has been deactivated. Please ask for a new one.'
        : 'This link has expired. Please ask for a new one.';
    return NextResponse.json({ error, reason: usable.reason }, { status: 410 });
  }

  try {
    const { agentId, token: conversationToken } = await mintLoanToken();
    return NextResponse.json({ agentId, conversationToken });
  } catch (e) {
    console.error('[loan] public session failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }
}
