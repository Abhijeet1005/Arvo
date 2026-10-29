import { NextResponse } from 'next/server';
import { approveMany, requeueSandbox } from '@/lib/autopilot/actions';

export const dynamic = 'force-dynamic';

// Actions on many prospects at once.
// Body: { action: 'approve', ids?: [] }   approve these drafts (all when ids is empty)
//       { action: 'requeue_sandbox' }     send the real email to prospects tried in sandbox
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (body.action === 'approve') return NextResponse.json(await approveMany(body.ids));
  if (body.action === 'requeue_sandbox') return NextResponse.json(await requeueSandbox());
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
