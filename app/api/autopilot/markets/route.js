import { NextResponse } from 'next/server';
import { addMarket, setMarketStatus } from '@/lib/autopilot/actions';

export const dynamic = 'force-dynamic';

// Add a market. Body: { vertical, city, industry? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const result = await addMarket(body);
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}

// Pause, test or activate a market. Body: { id, status }
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const result = await setMarketStatus(String(body.id || ''), String(body.status || ''));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
