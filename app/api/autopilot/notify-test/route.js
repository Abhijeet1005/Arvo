import { NextResponse } from 'next/server';
import { testNotification } from '@/lib/autopilot/alerts';

export const dynamic = 'force-dynamic';

// Send a test notification to the operator's address (and webhook, if set).
export async function POST() {
  const sent = await testNotification();
  if (!sent.length) return NextResponse.json({ error: 'Nothing was sent. Add a notification address in Settings and check the outreach mailbox.' }, { status: 400 });
  return NextResponse.json({ ok: true, sent });
}
