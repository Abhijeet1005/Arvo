// Demo connector: serves the built-in sample data so the agent works
// out of the box, before a client connects a real system.
import { findOrder, findTicket } from '@/lib/mocks';

export async function query(intent, params) {
  if (intent === 'lookup_order') {
    const order = findOrder(String(params.order_id || '').trim().toUpperCase());
    return { found: !!order, data: order || null };
  }
  if (intent === 'lookup_ticket') {
    const ticket = findTicket(String(params.ticket_id || '').trim().toUpperCase());
    return { found: !!ticket, data: ticket || null };
  }
  return { found: false, data: null, error: `Unknown intent: ${intent}` };
}
