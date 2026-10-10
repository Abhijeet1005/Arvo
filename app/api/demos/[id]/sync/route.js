import { NextResponse } from 'next/server';
import { syncDemoAgent } from '@/lib/demos/agent';
import { demoViewById } from '@/lib/demos/overview';
import { DEMO_ID_RE } from '@/lib/demos/model';
import { getDemo } from '@/lib/demos/store';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Rebuild the demo's agent from the demo as it is now. Used to retry after a
// failed save, or after the ElevenLabs account or key changed.
export async function POST(_req, { params }) {
  const { id } = await params;
  if (!DEMO_ID_RE.test(id)) return NextResponse.json({ error: 'Invalid demo id.' }, { status: 400 });
  if (!(await getDemo(id))) return NextResponse.json({ error: 'Demo not found.' }, { status: 404 });
  try {
    await syncDemoAgent(id, { force: true });
  } catch (e) {
    console.error('[demos] agent sync failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }
  return NextResponse.json({ ok: true, demo: await demoViewById(id) });
}
