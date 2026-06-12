import { NextResponse } from 'next/server';
import { runConnector } from '@/lib/connectors';

// Webhook tool: the agent calls this to look up a support ticket status.
// Routes through whichever data source the workspace has connected.
export async function POST(req) {
  const { ticket_id } = await req.json().catch(() => ({}));
  if (!ticket_id) return NextResponse.json({ error: 'ticket_id is required' });

  try {
    const { found, data } = await runConnector('lookup_ticket', { ticket_id });
    if (!found) return NextResponse.json({ found: false, message: `No ticket found with ID ${ticket_id}` });
    return NextResponse.json({ found: true, ticket_id, ...data });
  } catch (e) {
    console.error('[lookup-ticket] failed:', e);
    return NextResponse.json({ found: false, message: 'Could not reach the ticket system right now.' });
  }
}
