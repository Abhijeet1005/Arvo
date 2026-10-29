import { NextResponse } from 'next/server';
import { createDemoWithLink } from '@/lib/demos/create';
import { demoViews, demoViewById } from '@/lib/demos/overview';
import { callPath } from '@/lib/demos/links';
import { notificationsEnabled } from '@/lib/demos/notify';
import { mailEnabled } from '@/lib/demos/mail';
import { ensureSweeper } from '@/lib/demos/calls';
import { TEMPLATES, INDUSTRIES, DEMO_LANGUAGES } from '@/lib/demos/templates';
import { keyStatus } from '@/lib/loan/settings';

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
    mail: mailEnabled(),
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
  let warning;
  try {
    ({ demo, warning } = await createDemoWithLink(body));
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not create the demo.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, demo: await demoViewById(demo.id), ...(warning ? { warning } : {}) }, { status: 201 });
}
