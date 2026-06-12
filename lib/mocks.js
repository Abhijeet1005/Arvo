// In-memory mock data so the agent works before real APIs are wired in.
// The agent's tools (in agent.js) call these functions. Replace the bodies
// with real DB / API calls when you're ready to connect live systems.

const SAMPLE_ORDERS = {
  'ORD-1001': {
    status: 'shipped',
    items: ['Wireless Headphones'],
    tracking_id: 'AWB-789456123',
    expected_delivery: '2026-06-10',
    courier: 'BlueDart'
  },
  'ORD-1002': {
    status: 'processing',
    items: ['Smart Watch', 'Charging Cable'],
    expected_delivery: '2026-06-12'
  },
  'ORD-1003': {
    status: 'delivered',
    items: ['Bluetooth Speaker'],
    delivered_on: '2026-06-03'
  }
};

const SAMPLE_TICKETS = {
  'TKT-501': {
    status: 'in_progress',
    subject: 'Refund for damaged item',
    assigned_to: 'Priya from Customer Care',
    last_update: '2026-06-05',
    eta: '24 hours'
  },
  'TKT-502': {
    status: 'resolved',
    subject: 'Login issue',
    resolved_on: '2026-06-04'
  }
};

const messages = [];
const transferRequests = [];

export function findOrder(id) {
  return SAMPLE_ORDERS[id] || null;
}

export function findTicket(id) {
  return SAMPLE_TICKETS[id] || null;
}

export function saveMessage({ name, contact, message }) {
  const entry = {
    id: `MSG-${Date.now()}`,
    name,
    contact,
    message,
    received_at: new Date().toISOString()
  };
  messages.push(entry);
  console.log('[take-message] saved:', entry);
  return entry;
}

export function logTransferRequest({ reason, urgency }) {
  const entry = {
    id: `XFR-${Date.now()}`,
    reason,
    urgency,
    requested_at: new Date().toISOString()
  };
  transferRequests.push(entry);
  console.log('[request-transfer] logged:', entry);
  return entry;
}
