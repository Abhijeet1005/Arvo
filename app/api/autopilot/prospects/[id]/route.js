import { NextResponse } from 'next/server';
import { prospectAction } from '@/lib/autopilot/actions';

export const dynamic = 'force-dynamic';

const ID_RE = /^prs_[a-f0-9]{10}$/;

// One prospect. Body: { action: 'approve' | 'reject' | 'edit' | 'linkedin_sent' | 'retry' | 'close', draft?, reason? }
export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'Invalid prospect id.' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const result = await prospectAction(id, String(body.action || ''), body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
