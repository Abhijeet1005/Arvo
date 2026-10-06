import { NextResponse } from 'next/server';
import { listLlms, listAccountVoices, getSubscription } from '@/lib/loan/catalog';
import { keyStatus } from '@/lib/loan/settings';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// What the configured ElevenLabs account offers, for the dashboard's pickers.
// Each part fails independently so one error doesn't blank the whole page.
export async function GET() {
  const key = await keyStatus();
  if (!key.configured) {
    return NextResponse.json({ key, llms: null, voices: null, subscription: null, error: 'No ElevenLabs API key is set.' });
  }

  const [llms, voices, subscription] = await Promise.allSettled([listLlms(), listAccountVoices(), getSubscription()]);
  const reason = (r) => (r.status === 'rejected' ? friendlyError(r.reason) : null);

  return NextResponse.json({
    key,
    llms: llms.status === 'fulfilled' ? llms.value : null,
    llmsError: reason(llms),
    voices: voices.status === 'fulfilled' ? voices.value : null,
    voicesError: reason(voices),
    subscription: subscription.status === 'fulfilled' ? subscription.value : null,
  });
}
