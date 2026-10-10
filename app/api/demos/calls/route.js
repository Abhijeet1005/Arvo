import { NextResponse } from 'next/server';
import { listCalls, FINAL_STATUSES } from '@/lib/loan/calls';
import { refreshDemoCall } from '@/lib/demos/calls';

export const dynamic = 'force-dynamic';

const LIMIT = 60;
const REFRESH_AT_ONCE = 5;

const demoCalls = async () => (await listCalls()).filter((c) => c.demoId).slice(0, LIMIT);

// Recent calls made through demo links, newest first: the activity feed in the
// Demos view. Calls still waiting for their analysis are refreshed on the way.
export async function GET() {
  const recent = await demoCalls();
  const waiting = recent.filter((c) => !FINAL_STATUSES.has(c.status)).slice(0, REFRESH_AT_ONCE);
  if (waiting.length === 0) return NextResponse.json({ calls: recent });

  await Promise.all(waiting.map((c) => refreshDemoCall(c.id).catch(() => null)));
  return NextResponse.json({ calls: await demoCalls() });
}
