import { NextResponse } from 'next/server';
import { setDashboardApiKey, clearDashboardApiKey, keyStatus } from '@/lib/loan/settings';
import { elevenlabs, friendlyError, isRejected } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Use a different ElevenLabs API key (e.g. rotating test accounts) without
// editing .env.local or restarting. The key is checked against ElevenLabs,
// stored in the gitignored .agent.json, and never sent back to the browser.
// Body: { apiKey }
export async function PUT(req) {
  const body = await req.json().catch(() => ({}));
  const apiKey = String(body.apiKey || '').trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    return NextResponse.json({ error: 'That doesn’t look like an ElevenLabs API key.' }, { status: 400 });
  }

  try {
    await elevenlabs('/v1/convai/agents', { query: { page_size: 1 }, apiKey });
  } catch (e) {
    // Any 4xx means ElevenLabs refused the key itself (invalid, revoked, or
    // missing permissions); anything else is a network/outage problem.
    if (isRejected(e)) {
      return NextResponse.json({ error: `ElevenLabs rejected this key: ${e.message}` }, { status: 400 });
    }
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }

  await setDashboardApiKey(apiKey);
  return NextResponse.json({ ok: true, key: await keyStatus() });
}

// Stop using the dashboard key and fall back to .env.local.
export async function DELETE() {
  await clearDashboardApiKey();
  return NextResponse.json({ ok: true, key: await keyStatus() });
}
