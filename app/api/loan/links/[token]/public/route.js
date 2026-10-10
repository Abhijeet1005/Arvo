import { NextResponse } from 'next/server';
import { loadPublicLink } from '@/lib/loan/publicLink';

export const dynamic = 'force-dynamic';

// PUBLIC route — hit by the client's browser with just the token, no
// operator session. Only ever returns what a non-technical client should
// see (see lib/loan/publicLink.js): never `note`, `callIds`, `revoked`,
// `expiresAt`, or the token itself.
export async function GET(_req, { params }) {
  const { token } = await params;
  const result = await loadPublicLink(token);
  if (!result.ok) {
    // `reason` lets the UI show distinct copy without parsing the message.
    return NextResponse.json({ error: result.error, ...(result.reason ? { reason: result.reason } : {}) }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
