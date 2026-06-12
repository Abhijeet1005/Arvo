// REST / HTTP connector. Points at a client's existing API (helpdesk,
// store backend, CRM). Read-only by intent, with an output field allowlist
// so we never surface data the agent shouldn't speak.

function applyAuth(headers, auth) {
  if (!auth || auth.type === 'none') return;
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;
  else if (auth.type === 'header') headers[auth.headerName || 'X-API-Key'] = auth.token || '';
}

// "/orders/{order_id}" + { order_id: "ORD-1001" } -> "/orders/ORD-1001"
function fillPath(template, params) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) =>
    encodeURIComponent(params[k] ?? '')
  );
}

// Walk a dotted path, e.g. "data.order" -> body.data.order
function dig(body, path) {
  if (!path) return body;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), body);
}

// Keep only allowlisted fields (if configured).
function pick(obj, fields) {
  if (!obj || !Array.isArray(fields) || fields.length === 0) return obj;
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}

export async function query(intent, params, config = {}) {
  const def = config.intents?.[intent];
  if (!def || !def.path) {
    return { found: false, data: null, error: `Intent "${intent}" is not configured` };
  }

  const base = String(config.baseUrl || '').replace(/\/$/, '');
  const url = base + fillPath(def.path, params);
  const headers = { Accept: 'application/json' };
  applyAuth(headers, config.auth);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), def.timeoutMs || 8000);
  let res;
  try {
    res = await fetch(url, {
      method: (def.method || 'GET').toUpperCase(),
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) return { found: false, data: null };
  if (!res.ok) throw new Error(`Upstream responded ${res.status}`);

  const body = await res.json().catch(() => null);
  const record = dig(body, def.dataPath);
  if (record == null) return { found: false, data: null };
  return { found: true, data: pick(record, def.outputFields) };
}
