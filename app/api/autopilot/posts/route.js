import { NextResponse } from 'next/server';
import { markPostUsed } from '@/lib/autopilot/actions';

export const dynamic = 'force-dynamic';

// Mark a LinkedIn post draft as used (or not). Body: { id, used }
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const result = await markPostUsed(String(body.id || ''), body.used !== false);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
