import { NextResponse } from 'next/server';
import { revokeShareLink } from '@/lib/loan/shareLinks';

export const dynamic = 'force-dynamic';

// Revoke a share link (operator). Revoking doesn't delete the record — past
// calls made through it stay in the log — it just stops the public page and
// session route from working for it.
export async function DELETE(_req, { params }) {
  const { token } = await params;
  const link = await revokeShareLink(token);
  if (!link) return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
