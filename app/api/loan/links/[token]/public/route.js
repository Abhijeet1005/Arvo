import { NextResponse } from 'next/server';
import { getShareLink, isLinkUsable, TOKEN_RE } from '@/lib/loan/shareLinks';
import { getSettings } from '@/lib/loan/settings';

export const dynamic = 'force-dynamic';

// PUBLIC route — hit by the client's browser with just the token, no
// operator session. Only ever returns what a non-technical client should
// see: never `note`, `callIds`, `revoked`, `expiresAt`, or the token itself.
export async function GET(_req, { params }) {
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
    // `reason` lets the UI show distinct copy without parsing the message.
    return NextResponse.json({ error, reason: usable.reason }, { status: 410 });
  }

  const settings = await getSettings();
  return NextResponse.json({
    customerName: link.customerName,
    customerPhone: link.customerPhone,
    companyName: settings.companyName,
    agentName: settings.agentName,
  });
}
