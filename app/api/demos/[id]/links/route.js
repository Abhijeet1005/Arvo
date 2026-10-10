import { NextResponse } from 'next/server';
import { getDemo } from '@/lib/demos/store';
import { demoViewById } from '@/lib/demos/overview';
import { DEMO_ID_RE } from '@/lib/demos/model';
import { createShareLink } from '@/lib/loan/shareLinks';

export const dynamic = 'force-dynamic';

// Add another link to a demo (for example one per person at the company, so
// each has their own call allowance).
// Body: { label?, expiresInDays?, maxSessions? }
export async function POST(req, { params }) {
  const { id } = await params;
  if (!DEMO_ID_RE.test(id)) return NextResponse.json({ error: 'Invalid demo id.' }, { status: 400 });
  if (!(await getDemo(id))) return NextResponse.json({ error: 'Demo not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  try {
    const link = await createShareLink({
      demoId: id,
      label: body.label,
      // Demo links last a month unless told otherwise (null = never expires).
      expiresInDays: body.expiresInDays === undefined ? 30 : body.expiresInDays,
      maxSessions: body.maxSessions,
    });
    const demo = await demoViewById(id);
    return NextResponse.json({ ok: true, demo, link: demo.links.find((l) => l.token === link.token) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not create the link.' }, { status: 400 });
  }
}
