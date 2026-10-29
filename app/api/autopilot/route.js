import { NextResponse } from 'next/server';
import { autopilotView, rememberPublicUrl } from '@/lib/autopilot/view';
import { saveSettings } from '@/lib/autopilot/actions';
import { startAutopilot } from '@/lib/autopilot/scheduler';

export const dynamic = 'force-dynamic';

// Everything the Autopilot view needs in one round trip.
export async function GET(req) {
  startAutopilot();
  await rememberPublicUrl(req);
  return NextResponse.json(await autopilotView());
}

// Change settings (mode, caps, sender, ...). Body: see sanitiseSettings in
// lib/autopilot/model.js. Unknown or invalid values are ignored.
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  await saveSettings(body);
  return NextResponse.json(await autopilotView());
}
