import { NextResponse } from 'next/server';
import { appendItem } from '@/lib/store';

// Webhook tool: the agent collects a caller's message and saves it.
export async function POST(req) {
  const { name, contact, message } = await req.json().catch(() => ({}));
  if (!name || !contact || !message) {
    return NextResponse.json({ error: 'name, contact, and message are required' });
  }
  const entry = {
    id: `MSG-${Date.now()}`,
    name,
    contact,
    message,
    received_at: new Date().toISOString(),
  };
  await appendItem('messages', entry);
  console.log('[take-message] saved:', entry.id);
  return NextResponse.json({ saved: true, reference_id: entry.id });
}
