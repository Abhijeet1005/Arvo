import { NextResponse } from 'next/server';
import { runTick, startAutopilot } from '@/lib/autopilot/scheduler';

export const dynamic = 'force-dynamic';
// A run can research a market and qualify several websites.
export const maxDuration = 300;

// Run the autopilot once now, instead of waiting for its next tick.
export async function POST() {
  startAutopilot();
  const result = await runTick();
  if (result.busy) return NextResponse.json({ error: 'The autopilot is already running. Give it a minute.' }, { status: 409 });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
