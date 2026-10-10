import { NextResponse } from 'next/server';
import { readWebsite, SiteError } from '@/lib/demos/fetchSite';

export const dynamic = 'force-dynamic';

// Read a company's website and suggest the demo's business details: name,
// what they do, hours, contact details, logo and colour, plus the text the
// assistant will answer from. Nothing is saved; the operator reviews it first.
// Body: { url }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    const profile = await readWebsite(String(body.url || ''));
    return NextResponse.json({ ok: true, ...profile });
  } catch (e) {
    if (e instanceof SiteError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === 'busy' ? 429 : 422 });
    }
    console.error('[demos] website read failed:', e);
    return NextResponse.json({ error: 'That website could not be read.' }, { status: 502 });
  }
}
