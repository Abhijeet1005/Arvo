import { NextResponse } from 'next/server';
import { editDemo, deleteDemo, getDemo } from '@/lib/demos/store';
import { syncDemoAgent, removeDemoAgent } from '@/lib/demos/agent';
import { demoViewById } from '@/lib/demos/overview';
import { DEMO_ID_RE } from '@/lib/demos/model';
import { revokeLinksForDemo } from '@/lib/loan/shareLinks';
import { removeCallsForDemo } from '@/lib/loan/calls';
import { keyStatus } from '@/lib/loan/settings';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Edit a demo. The agent is updated to match; if ElevenLabs refuses, the edit
// is still saved and a `warning` explains what is not live yet.
export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!DEMO_ID_RE.test(id)) return NextResponse.json({ error: 'Invalid demo id.' }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  let demo;
  try {
    demo = await editDemo(id, body);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not save the demo.' }, { status: 400 });
  }
  if (!demo) return NextResponse.json({ error: 'Demo not found.' }, { status: 404 });

  let warning = '';
  if ((await keyStatus()).configured) {
    try {
      await syncDemoAgent(id);
    } catch (e) {
      console.error('[demos] agent sync failed:', e);
      warning = `Saved, but the agent was not updated: ${friendlyError(e)}`;
    }
  }
  return NextResponse.json({ ok: true, demo: await demoViewById(id), ...(warning ? { warning } : {}) });
}

// Delete a demo: its links stop working at once, its agent is removed from
// ElevenLabs and its calls leave the log (recordings stay in ElevenLabs).
export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!DEMO_ID_RE.test(id)) return NextResponse.json({ error: 'Invalid demo id.' }, { status: 400 });
  const demo = await getDemo(id);
  if (!demo) return NextResponse.json({ error: 'Demo not found.' }, { status: 404 });

  await revokeLinksForDemo(id);

  let warning = '';
  try {
    await removeDemoAgent(demo);
  } catch (e) {
    console.error('[demos] agent removal failed:', e);
    warning = `The demo was deleted, but its agent could not be removed from ElevenLabs (${friendlyError(e)}). Delete it there if it still shows.`;
  }

  await deleteDemo(id);
  await removeCallsForDemo(id);
  return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) });
}
