import { NextResponse } from 'next/server';
import { refreshCall, removeCall, CONVERSATION_ID_RE } from '@/lib/loan/calls';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Latest state of one call. The browser polls this after hanging up until the
// END-OF-CALL OUTPUT is ready.
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!CONVERSATION_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid call id.' }, { status: 400 });
  }
  try {
    const call = await refreshCall(id);
    if (!call) return NextResponse.json({ error: 'Call not found.' }, { status: 404 });
    return NextResponse.json({ call });
  } catch (e) {
    console.error('[loan] refresh failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }
}

// Remove a call from the local log (demo housekeeping). The recording stays
// in ElevenLabs.
export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!CONVERSATION_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid call id.' }, { status: 400 });
  }
  await removeCall(id);
  return NextResponse.json({ ok: true });
}
