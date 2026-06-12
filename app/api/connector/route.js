import { NextResponse } from 'next/server';
import { readStore, writeStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Never send stored secrets back to the browser. We blank them and send a
// flag so the UI can show "saved — leave blank to keep".
function forClient(connector) {
  const c = connector ? JSON.parse(JSON.stringify(connector)) : { type: 'demo' };
  const restHasToken = !!c.rest?.auth?.token;
  const pgHasConn = !!c.postgres?.connectionString;
  if (c.rest?.auth) c.rest.auth.token = '';
  if (c.postgres) c.postgres.connectionString = '';
  return { connector: c, restHasToken, pgHasConn };
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json(forClient(store.connector));
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const incoming = body.connector || { type: 'demo' };

  // Preserve existing secrets when the form submits them blank.
  const store = await readStore();
  const existing = store.connector || {};
  if (incoming.rest?.auth && !incoming.rest.auth.token) {
    incoming.rest.auth.token = existing.rest?.auth?.token || '';
  }
  if (incoming.postgres && !incoming.postgres.connectionString) {
    incoming.postgres.connectionString = existing.postgres?.connectionString || '';
  }

  await writeStore({ connector: incoming });
  return NextResponse.json({ ok: true, ...forClient(incoming) });
}
