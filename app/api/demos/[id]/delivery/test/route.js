import { NextResponse } from 'next/server';
import { getDemo } from '@/lib/demos/store';
import { sendTestLead } from '@/lib/demos/notify';
import { mailEnabled } from '@/lib/demos/mail';
import { DEMO_ID_RE } from '@/lib/demos/model';

export const dynamic = 'force-dynamic';

// Send a made-up lead to the addresses saved on the demo, to check that the
// client's inbox receives it. Only ever mails the saved addresses.
export async function POST(_req, { params }) {
  const { id } = await params;
  if (!DEMO_ID_RE.test(id)) return NextResponse.json({ error: 'Invalid demo id.' }, { status: 400 });
  const demo = await getDemo(id);
  if (!demo) return NextResponse.json({ error: 'Demo not found.' }, { status: 404 });
  if (!mailEnabled()) {
    return NextResponse.json({ error: 'Email is not set up on this server yet. Set ARVO_SMTP_URL (see the README).' }, { status: 409 });
  }
  const sent = await sendTestLead(demo);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
  return NextResponse.json({ ok: true, to: demo.delivery.emails });
}
