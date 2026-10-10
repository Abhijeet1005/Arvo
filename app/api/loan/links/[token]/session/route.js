import { NextResponse } from 'next/server';
import { getShareLink, isLinkUsable, reserveDemoSession, releaseDemoSession, TOKEN_RE } from '@/lib/loan/shareLinks';
import { mintLoanToken } from '@/lib/loan/agent';
import { mintDemoToken } from '@/lib/demos/agent';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// What a visitor is told when a demo link can't start another call.
const DEMO_REFUSALS = {
  not_found: [404, 'This link was not found.'],
  revoked: [410, 'This link has been deactivated. Please ask for a new one.'],
  expired: [410, 'This link has expired. Please ask for a new one.'],
  limit: [429, 'This demo link has reached its limit of calls. Please ask for a new one.'],
  busy: [429, 'Please wait a few seconds and try again.'],
};

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

  // A demo link starts that demo's own agent, and counts the attempt first so
  // the cap holds even if the browser never reports the call back.
  if (link.demoId) {
    const reserved = await reserveDemoSession(token);
    if (!reserved.ok) {
      const [status, error] = DEMO_REFUSALS[reserved.reason] || DEMO_REFUSALS.not_found;
      return NextResponse.json({ error, reason: reserved.reason }, { status });
    }
    try {
      const { agentId, token: conversationToken } = await mintDemoToken(link.demoId);
      return NextResponse.json({ agentId, conversationToken });
    } catch (e) {
      console.error('[demos] public session failed:', e);
      await releaseDemoSession(token);
      // Visitors never see operator-facing hints (API keys, credits).
      return NextResponse.json({ error: 'The demo could not start just now. Please try again in a moment.' }, { status: 502 });
    }
  }

  try {
    const { agentId, token: conversationToken } = await mintLoanToken();
    return NextResponse.json({ agentId, conversationToken });
  } catch (e) {
    console.error('[loan] public session failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }
}
