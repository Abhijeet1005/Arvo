import { NextResponse } from 'next/server';
import { runConnector } from '@/lib/connectors';

// Webhook tool: the agent calls this to look up an order's status.
// Routes through whichever data source the workspace has connected.
export async function POST(req) {
  const { order_id } = await req.json().catch(() => ({}));
  if (!order_id) return NextResponse.json({ error: 'order_id is required' });

  try {
    const { found, data } = await runConnector('lookup_order', { order_id });
    if (!found) return NextResponse.json({ found: false, message: `No order found with ID ${order_id}` });
    return NextResponse.json({ found: true, order_id, ...data });
  } catch (e) {
    console.error('[lookup-order] failed:', e);
    return NextResponse.json({ found: false, message: 'Could not reach the order system right now.' });
  }
}
