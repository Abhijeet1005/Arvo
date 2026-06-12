// Registers the agent's webhook tools with ElevenLabs and remembers their
// ids. The agent calls these tools during a conversation; each one hits a
// route under /api/tools/* which routes through the active connector.
//
// Tools point at an ABSOLUTE, public URL (the agent calls them from
// ElevenLabs' servers), so this is a no-op until APP_URL is a real public
// URL — localhost can't receive the webhook. Set APP_URL after deploy.
import { readStore, writeStore } from '@/lib/store';

function publicBaseUrl() {
  const u = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (!u) return null;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(u)) return null;
  return u;
}

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });

function toolSpecs(base) {
  return [
    {
      name: 'lookup_order',
      toolConfig: {
        type: 'webhook',
        name: 'lookup_order',
        description:
          'Look up the current status of a customer order by its order ID. Use when the caller asks about an order, delivery, shipment, or tracking.',
        responseTimeoutSecs: 15,
        apiSchema: {
          url: `${base}/api/tools/lookup-order`,
          method: 'POST',
          requestBodySchema: {
            type: 'object',
            required: ['order_id'],
            properties: { order_id: str('The order ID, for example ORD-1001.') },
          },
        },
      },
    },
    {
      name: 'lookup_ticket',
      toolConfig: {
        type: 'webhook',
        name: 'lookup_ticket',
        description:
          'Look up the status of a support ticket by its ticket ID. Use when the caller asks about a complaint, request, or an existing ticket.',
        responseTimeoutSecs: 15,
        apiSchema: {
          url: `${base}/api/tools/lookup-ticket`,
          method: 'POST',
          requestBodySchema: {
            type: 'object',
            required: ['ticket_id'],
            properties: { ticket_id: str('The ticket ID, for example TKT-501.') },
          },
        },
      },
    },
    {
      name: 'take_message',
      toolConfig: {
        type: 'webhook',
        name: 'take_message',
        description:
          "Record a message from the caller when their request can't be resolved on the call. Collect their name, a contact (phone or email), and the message.",
        responseTimeoutSecs: 15,
        apiSchema: {
          url: `${base}/api/tools/take-message`,
          method: 'POST',
          requestBodySchema: {
            type: 'object',
            required: ['name', 'contact', 'message'],
            properties: {
              name: str("The caller's name."),
              contact: str('A phone number or email to reach them.'),
              message: str('The message to pass on.'),
            },
          },
        },
      },
    },
    {
      name: 'request_transfer',
      toolConfig: {
        type: 'webhook',
        name: 'request_transfer',
        description:
          'Request a handoff to a human agent when the caller asks for a person or the issue clearly needs one. Provide a short reason and the urgency.',
        responseTimeoutSecs: 15,
        apiSchema: {
          url: `${base}/api/tools/request-transfer`,
          method: 'POST',
          requestBodySchema: {
            type: 'object',
            required: ['reason'],
            properties: {
              reason: str('Why a transfer is needed.'),
              urgency: str('How urgent the handoff is.', { enum: ['normal', 'high'] }),
            },
          },
        },
      },
    },
  ];
}

// Ensure the webhook tools exist and store their ids ({ name: id }).
// Create-if-missing: cheap and idempotent. If APP_URL changes, clear the
// "tools" key in .agent.json to force re-registration at the new URL.
export async function syncTools(el) {
  const base = publicBaseUrl();
  if (!base) return { skipped: true, reason: 'APP_URL not set to a public URL' };

  const store = await readStore();
  const tools = { ...(store.tools || {}) };
  let changed = false;

  for (const spec of toolSpecs(base)) {
    if (tools[spec.name]) continue;
    const res = await el.conversationalAi.tools.create({ toolConfig: spec.toolConfig });
    tools[spec.name] = res.id;
    changed = true;
  }

  if (changed) await writeStore({ tools });
  return { tools };
}
