import { NextResponse } from 'next/server';
import { appendItem } from '@/lib/store';

// Webhook tool: the agent calls this when a human handoff is needed.
export async function POST(req) {
  const { reason, urgency = 'normal' } = await req.json().catch(() => ({}));
  const entry = {
    id: `XFR-${Date.now()}`,
    reason: reason || 'unspecified',
    urgency,
    requested_at: new Date().toISOString(),
  };
  await appendItem('transfers', entry);
  console.log('[request-transfer] logged:', entry.id);
  return NextResponse.json({
    transfer_acknowledged: true,
    reference_id: entry.id,
    estimated_wait_minutes: urgency === 'high' ? 2 : 5,
  });
}
