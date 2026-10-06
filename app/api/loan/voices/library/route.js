import { NextResponse } from 'next/server';
import { searchLibrary, LIBRARY_LANGUAGES } from '@/lib/loan/catalog';
import { friendlyError } from '@/lib/loan/elevenlabs';

export const dynamic = 'force-dynamic';

// Search ElevenLabs' public voice library.
// Query: search?, language? (hi | en-in | en | all), gender?, useCase? (conversational | any), page?
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const page = Math.max(0, Math.min(50, Number.parseInt(q.get('page') || '0', 10) || 0));
  const language = LIBRARY_LANGUAGES[q.get('language')] ? q.get('language') : 'hi';
  try {
    const result = await searchLibrary({
      search: String(q.get('search') || '').trim(),
      language,
      gender: String(q.get('gender') || ''),
      useCase: q.get('useCase') === 'any' ? 'any' : 'conversational',
      page,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[loan] library search failed:', e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 502 });
  }
}
