// Direct database connector (read-only). The client provides a connection
// string and, per intent, a SELECT query with named params. We refuse
// anything that isn't a SELECT, and only ever run the allowlisted queries
// configured here — never free-form SQL from the agent.

function mapParams(def, params) {
  return (def.params || []).map((name) => params[name]);
}

export async function query(intent, params, config = {}) {
  const def = config.intents?.[intent];
  if (!def || !def.query) {
    return { found: false, data: null, error: `Intent "${intent}" is not configured` };
  }

  const sql = String(def.query).trim();
  if (!/^select\s/i.test(sql)) {
    throw new Error('Only SELECT queries are allowed for the database connector');
  }

  // Loaded lazily so the app builds/runs even without the driver present.
  let pg;
  try {
    pg = await import('pg');
  } catch {
    throw new Error('Postgres driver (pg) is not installed');
  }
  const { Client } = pg.default || pg;

  const client = new Client({
    connectionString: config.connectionString,
    statement_timeout: 8000,
    connectionTimeoutMillis: 8000,
  });

  await client.connect();
  try {
    const result = await client.query({ text: sql, values: mapParams(def, params) });
    const row = result.rows?.[0] || null;
    return { found: !!row, data: row };
  } finally {
    await client.end().catch(() => {});
  }
}
