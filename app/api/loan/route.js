import { NextResponse } from 'next/server';
import { getSettings, saveSettings, sanitiseSettings, defaultSettings, keyStatus } from '@/lib/loan/settings';
import { syncAgent, currentAgentId } from '@/lib/loan/agent';
import { listLlms, normaliseLlm } from '@/lib/loan/catalog';
import { listCalls } from '@/lib/loan/calls';
import { unknownPlaceholders, PER_CALL_VARIABLES } from '@/lib/loan/options';
import { friendlyError, isRejected } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Everything the loan-advisor page needs in one round trip.
export async function GET() {
  const [settings, calls, key, agentId] = await Promise.all([
    getSettings(),
    listCalls(),
    keyStatus(),
    currentAgentId(),
  ]);
  return NextResponse.json({ settings, defaults: defaultSettings(), agent: { id: agentId, key }, calls });
}

// Save settings. They're pushed to the ElevenLabs agent first and only
// persisted once ElevenLabs accepts them, so what's saved is what runs.
// Body: any subset of the settings in lib/loan/options.js.
export async function PUT(req) {
  const body = await req.json().catch(() => ({}));
  let candidate = sanitiseSettings(body, await getSettings());

  // Only the per-call placeholders get filled in; anything else would break calls.
  const unknown = [...unknownPlaceholders(candidate.firstMessage), ...unknownPlaceholders(candidate.prompt)];
  if (unknown.length) {
    const allowed = PER_CALL_VARIABLES.map((v) => `{{${v}}}`).join(' and ');
    return NextResponse.json(
      { error: `Unknown placeholder {{${unknown[0]}}}. Only ${allowed} are filled in on each call.` },
      { status: 400 }
    );
  }

  const key = await keyStatus();
  if (!key.configured) {
    await saveSettings(candidate);
    return NextResponse.json({
      ok: true,
      settings: candidate,
      warning: 'Saved. Add an ElevenLabs API key to sync the agent.',
    });
  }

  // Validate the model and pick a reasoning level it supports.
  try {
    const checked = normaliseLlm(candidate, await listLlms());
    if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
    candidate = checked.settings;
  } catch {
    // Model list unavailable: ElevenLabs still validates on sync below.
  }

  try {
    const agentId = await syncAgent(candidate);
    await saveSettings(candidate);
    return NextResponse.json({ ok: true, settings: candidate, agentId });
  } catch (e) {
    console.error('[loan] agent sync failed:', e);
    // A bad or expired key shouldn't block saving the rest of the setup.
    if (isRejected(e) && e.status !== 401) {
      return NextResponse.json({ error: friendlyError(e) }, { status: 422 });
    }
    await saveSettings(candidate);
    return NextResponse.json({
      ok: true,
      settings: candidate,
      warning: `Saved, but not synced yet: ${friendlyError(e)}`,
    });
  }
}
