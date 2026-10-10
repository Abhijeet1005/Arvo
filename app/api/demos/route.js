import { NextResponse } from 'next/server';
import { createDemo } from '@/lib/demos/store';
import { syncDemoAgent } from '@/lib/demos/agent';
import { demoViews, demoViewById } from '@/lib/demos/overview';
import { callPath } from '@/lib/demos/links';
import { notificationsEnabled } from '@/lib/demos/notify';
import { ensureSweeper } from '@/lib/demos/calls';
import { TEMPLATES, INDUSTRIES, DEMO_LANGUAGES } from '@/lib/demos/templates';
import { createShareLink } from '@/lib/loan/shareLinks';
import { keyStatus } from '@/lib/loan/settings';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Everything the Demos view needs in one round trip.
export async function GET() {
  ensureSweeper();
  const [demos, key] = await Promise.all([demoViews(), keyStatus()]);
  return NextResponse.json({
    demos,
    templates: TEMPLATES,
    industries: INDUSTRIES,
    languages: DEMO_LANGUAGES,
    keyConfigured: key.configured,
    alerts: notificationsEnabled(),
    callPath: callPath(),
  });
}

// Create a demo, its first link and its agent. The demo is kept even when the
// agent can't be created yet (no key, no credits); the response then carries
// a `warning` and the console offers a retry.
// Body: see lib/demos/model.js (sanitiseDemo).
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  let demo;
  try {
    demo = await createDemo(body);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not create the demo.' }, { status: 400 });
  }

  await createShareLink({ demoId: demo.id, label: 'Main link', expiresInDays: 30 });

  let warning = '';
  if (!(await keyStatus()).configured) {
    warning = 'Saved. Add an ElevenLabs API key under Configuration to bring the agent online.';
  } else {
    try {
      await syncDemoAgent(demo.id);
    } catch (e) {
      console.error('[demos] agent sync failed:', e);
      warning = `Saved, but the agent is not live yet: ${friendlyError(e)}`;
    }
  }

  return NextResponse.json({ ok: true, demo: await demoViewById(demo.id), ...(warning ? { warning } : {}) }, { status: 201 });
}
