import { NextResponse } from 'next/server';
import { addLibraryVoice, getAccountVoice } from '@/lib/loan/catalog';
import { friendlyError, isRejected } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Add a voice from the public library to this account's "My Voices", so the
// agent can speak with it. Body: { publicOwnerId, voiceId, name }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const publicOwnerId = String(body.publicOwnerId || '').trim();
  const voiceId = String(body.voiceId || '').trim();
  const name = String(body.name || '').replace(/[<>]/g, '').trim().slice(0, 100);

  if (!/^[a-f0-9]{16,128}$/i.test(publicOwnerId) || !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) {
    return NextResponse.json({ error: 'That library voice is missing its ids.' }, { status: 400 });
  }

  try {
    const id = await addLibraryVoice({ publicOwnerId, voiceId, name: name || voiceId });
    const voice = await getAccountVoice(id).catch(() => null);
    return NextResponse.json({ ok: true, voiceId: id, voice });
  } catch (e) {
    console.error('[loan] add voice failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: isRejected(e) ? 422 : 502 });
  }
}
