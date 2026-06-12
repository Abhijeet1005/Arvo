import { NextResponse } from 'next/server';
import { runConnector } from '@/lib/connectors';
import { readStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Try a lookup against the connector config in the request (unsaved), so the
// operator can test before saving. Real error text is returned here on
// purpose — this is the operator's own debugging tool, not the caller path.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const intent = body.intent === 'lookup_ticket' ? 'lookup_ticket' : 'lookup_order';
  const value = body.value;
  const override = body.connector || null;

  // Fall back to saved secrets if the form sent them blank.
  if (override) {
    const existing = (await readStore()).connector || {};
    if (override.rest?.auth && !override.rest.auth.token) {
      override.rest.auth.token = existing.rest?.auth?.token || '';
    }
    if (override.postgres && !override.postgres.connectionString) {
      override.postgres.connectionString = existing.postgres?.connectionString || '';
    }
  }

  const paramKey = intent === 'lookup_ticket' ? 'ticket_id' : 'order_id';
  try {
    const result = await runConnector(intent, { [paramKey]: value }, override);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('[connector-test] failed:', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) });
  }
}
