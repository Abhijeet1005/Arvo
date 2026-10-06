import { NextResponse } from 'next/server';
import { createShareLink, listShareLinks, isLinkUsable } from '@/lib/loan/shareLinks';

export const dynamic = 'force-dynamic';

// Relative path to the public call page (app/loan/call/[token]/page.js).
// The browser prepends window.location.origin to get an absolute link to copy.
function urlFor(token) {
  return `/loan/call/${token}`;
}

function statusOf(link) {
  const usable = isLinkUsable(link);
  return usable.ok ? 'active' : usable.reason;
}

// Shape returned to the operator dashboard: everything except the full
// callIds array, plus a computed status and count.
function forDashboard(link) {
  const { callIds, ...rest } = link;
  return { ...rest, status: statusOf(link), callCount: callIds.length, url: urlFor(link.token) };
}

// All share links created so far (operator dashboard).
export async function GET() {
  const links = await listShareLinks();
  return NextResponse.json({ links: links.map(forDashboard) });
}

// Create a link for one customer. Settings aren't frozen in — the link
// always uses whatever the agent's live config is when the call starts.
// Body: { customerName, customerPhone?, note?, expiresInDays? }
// expiresInDays: omit for the 7-day default, pass 1-30 to customize (clamped),
// or pass null for "never expires".
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    const link = await createShareLink({
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      note: body.note,
      expiresInDays: body.expiresInDays,
    });
    return NextResponse.json({ ok: true, link: forDashboard(link), url: urlFor(link.token) });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not create the link.' }, { status: 400 });
  }
}
