'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Loader2, Database, Globe, FlaskConical, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/20';

const INTENTS = [
  { key: 'lookup_order', label: 'Look up order', sample: 'ORD-1001' },
  { key: 'lookup_ticket', label: 'Look up ticket', sample: 'TKT-501' },
];

const TYPES = [
  { id: 'demo', label: 'Sample data', icon: FlaskConical, desc: 'Built-in demo orders & tickets' },
  { id: 'rest', label: 'REST API', icon: Globe, desc: 'Your helpdesk / store API' },
  { id: 'postgres', label: 'Database', icon: Database, desc: 'Read-only Postgres' },
];

const DEFAULT_REST = {
  baseUrl: '',
  auth: { type: 'none', token: '', headerName: 'X-API-Key' },
  intents: {
    lookup_order: { method: 'GET', path: '/orders/{order_id}', outputFields: 'status, items, expected_delivery', dataPath: '' },
    lookup_ticket: { method: 'GET', path: '/tickets/{ticket_id}', outputFields: 'status, subject, eta', dataPath: '' },
  },
};

const DEFAULT_PG = {
  connectionString: '',
  intents: {
    lookup_order: { query: 'SELECT status, items, expected_delivery FROM orders WHERE id = $1', params: 'order_id' },
    lookup_ticket: { query: 'SELECT status, subject, eta FROM tickets WHERE id = $1', params: 'ticket_id' },
  },
};

const csvToArr = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const arrToCsv = (a) => (Array.isArray(a) ? a.join(', ') : a || '');

function hydrateRest(i, fb) {
  if (!i) return fb;
  return { method: i.method || 'GET', path: i.path || '', outputFields: arrToCsv(i.outputFields), dataPath: i.dataPath || '' };
}
function hydratePg(i, fb) {
  if (!i) return fb;
  return { query: i.query || '', params: arrToCsv(i.params) };
}

export default function ConnectorConfig() {
  const [type, setType] = useState('demo');
  const [rest, setRest] = useState(DEFAULT_REST);
  const [pg, setPg] = useState(DEFAULT_PG);
  const [flags, setFlags] = useState({ restHasToken: false, pgHasConn: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [testIntent, setTestIntent] = useState('lookup_order');
  const [testValue, setTestValue] = useState('ORD-1001');
  const [testing, setTesting] = useState(false);
  const [testOut, setTestOut] = useState(null);

  useEffect(() => {
    fetch('/api/connector')
      .then((r) => r.json())
      .then((d) => {
        const c = d.connector || { type: 'demo' };
        setType(c.type || 'demo');
        if (c.rest) {
          setRest({
            baseUrl: c.rest.baseUrl || '',
            auth: { type: c.rest.auth?.type || 'none', token: '', headerName: c.rest.auth?.headerName || 'X-API-Key' },
            intents: {
              lookup_order: hydrateRest(c.rest.intents?.lookup_order, DEFAULT_REST.intents.lookup_order),
              lookup_ticket: hydrateRest(c.rest.intents?.lookup_ticket, DEFAULT_REST.intents.lookup_ticket),
            },
          });
        }
        if (c.postgres) {
          setPg({
            connectionString: '',
            intents: {
              lookup_order: hydratePg(c.postgres.intents?.lookup_order, DEFAULT_PG.intents.lookup_order),
              lookup_ticket: hydratePg(c.postgres.intents?.lookup_ticket, DEFAULT_PG.intents.lookup_ticket),
            },
          });
        }
        setFlags({ restHasToken: !!d.restHasToken, pgHasConn: !!d.pgHasConn });
      })
      .catch(() => {});
  }, []);

  // updaters
  const upRest = (k) => (e) => setRest((r) => ({ ...r, [k]: e.target.value }));
  const upAuth = (k) => (e) => setRest((r) => ({ ...r, auth: { ...r.auth, [k]: e.target.value } }));
  const upRestIntent = (intent, k) => (e) =>
    setRest((r) => ({ ...r, intents: { ...r.intents, [intent]: { ...r.intents[intent], [k]: e.target.value } } }));
  const upPgIntent = (intent, k) => (e) =>
    setPg((p) => ({ ...p, intents: { ...p.intents, [intent]: { ...p.intents[intent], [k]: e.target.value } } }));

  function buildConnector() {
    if (type === 'rest') {
      const mk = (i) => ({ method: i.method, path: i.path.trim(), outputFields: csvToArr(i.outputFields), dataPath: i.dataPath?.trim() || undefined });
      return {
        type: 'rest',
        rest: {
          baseUrl: rest.baseUrl.trim(),
          auth: rest.auth.type === 'none' ? { type: 'none' } : { type: rest.auth.type, token: rest.auth.token, headerName: rest.auth.headerName },
          intents: { lookup_order: mk(rest.intents.lookup_order), lookup_ticket: mk(rest.intents.lookup_ticket) },
        },
      };
    }
    if (type === 'postgres') {
      const mk = (i) => ({ query: i.query.trim(), params: csvToArr(i.params) });
      return { type: 'postgres', postgres: { connectionString: pg.connectionString, intents: { lookup_order: mk(pg.intents.lookup_order), lookup_ticket: mk(pg.intents.lookup_ticket) } } };
    }
    return { type: 'demo' };
  }

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connector: buildConnector() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save');
      setFlags({ restHasToken: !!d.restHasToken, pgHasConn: !!d.pgHasConn });
      setMsg('Saved ✓');
    } catch (e) {
      setMsg('Error: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestOut(null);
    try {
      const r = await fetch('/api/connector/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: testIntent, value: testValue, connector: buildConnector() }),
      });
      setTestOut(await r.json());
    } catch (e) {
      setTestOut({ ok: false, error: String(e.message || e) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Source type */}
      <div className="grid gap-3 sm:grid-cols-3">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out-strong active:scale-[0.99]',
                active ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:ring-emerald-500/20' : 'border-border bg-card hover:border-emerald-200 dark:hover:border-emerald-500/40'
              )}
            >
              <span className={cn('grid size-8 place-items-center rounded-lg', active ? 'bg-emerald-600 text-white' : 'bg-secondary text-muted-foreground')}>
                <Icon className="size-4" />
              </span>
              <span className="mt-1 text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </button>
          );
        })}
      </div>

      {/* DEMO */}
      {type === 'demo' && (
        <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          The agent uses built-in sample data so you can test immediately. Try order <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">ORD-1001</code> or ticket <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">TKT-501</code>. Switch to REST API or Database to connect a real source.
        </div>
      )}

      {/* REST */}
      {type === 'rest' && (
        <div className="space-y-4">
          <Field label="Base URL">
            <Input placeholder="https://api.yourcompany.com" value={rest.baseUrl} onChange={upRest('baseUrl')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Auth">
              <select className={selectCls} value={rest.auth.type} onChange={upAuth('type')}>
                <option value="none">None</option>
                <option value="bearer">Bearer token</option>
                <option value="header">API key header</option>
              </select>
            </Field>
            {rest.auth.type !== 'none' && (
              <Field label={flags.restHasToken ? 'Token (saved — blank keeps it)' : 'Token'}>
                <Input type="password" placeholder={flags.restHasToken ? '••••••' : ''} value={rest.auth.token} onChange={upAuth('token')} />
              </Field>
            )}
            {rest.auth.type === 'header' && (
              <Field label="Header name">
                <Input value={rest.auth.headerName} onChange={upAuth('headerName')} />
              </Field>
            )}
          </div>

          {INTENTS.map((it) => {
            const v = rest.intents[it.key];
            return (
              <div key={it.key} className="rounded-lg border border-border p-4">
                <div className="text-sm font-semibold">{it.label}</div>
                <div className="mt-3 grid gap-4 sm:grid-cols-4">
                  <Field label="Method">
                    <select className={selectCls} value={v.method} onChange={upRestIntent(it.key, 'method')}>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </Field>
                  <div className="sm:col-span-3">
                    <Field label="Path (use {placeholders})">
                      <Input value={v.path} onChange={upRestIntent(it.key, 'path')} />
                    </Field>
                  </div>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Output fields (the agent may speak these)">
                    <Input value={v.outputFields} onChange={upRestIntent(it.key, 'outputFields')} />
                  </Field>
                  <Field label="Response data path (optional)">
                    <Input placeholder="e.g. data.order" value={v.dataPath} onChange={upRestIntent(it.key, 'dataPath')} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POSTGRES */}
      {type === 'postgres' && (
        <div className="space-y-4">
          <Field label={flags.pgHasConn ? 'Connection string (saved — blank keeps it)' : 'Connection string'}>
            <Input type="password" placeholder={flags.pgHasConn ? '••••••' : 'postgres://user:pass@host:5432/db'} value={pg.connectionString} onChange={(e) => setPg((p) => ({ ...p, connectionString: e.target.value }))} />
          </Field>
          <p className="text-xs text-muted-foreground">Read-only: only <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">SELECT</code> queries run. Params map positionally to <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">$1, $2…</code></p>
          {INTENTS.map((it) => {
            const v = pg.intents[it.key];
            return (
              <div key={it.key} className="rounded-lg border border-border p-4">
                <div className="text-sm font-semibold">{it.label}</div>
                <div className="mt-3 space-y-3">
                  <Field label="SELECT query">
                    <Textarea rows={2} value={v.query} onChange={upPgIntent(it.key, 'query')} />
                  </Field>
                  <Field label="Params (in $1, $2 order)">
                    <Input value={v.params} onChange={upPgIntent(it.key, 'params')} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="animate-spin" /> Saving…</> : 'Save connector'}
        </Button>
        {msg && <span className={`text-sm font-medium ${msg.startsWith('Error') ? 'text-destructive' : 'text-emerald-600'}`}>{msg}</span>}
      </div>

      {/* Test */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="text-sm font-semibold">Test a lookup</div>
        <p className="mt-0.5 text-xs text-muted-foreground">Runs against the settings above (no need to save first).</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Intent">
            <select
              className={selectCls}
              value={testIntent}
              onChange={(e) => {
                setTestIntent(e.target.value);
                const found = INTENTS.find((i) => i.key === e.target.value);
                if (found) setTestValue(found.sample);
              }}
            >
              {INTENTS.map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Value">
            <Input value={testValue} onChange={(e) => setTestValue(e.target.value)} />
          </Field>
          <Button variant="secondary" onClick={runTest} disabled={testing}>
            {testing ? <><Loader2 className="animate-spin" /> Testing…</> : <><Play className="size-4" /> Test</>}
          </Button>
        </div>
        {testOut && (
          <pre className={cn('mt-3 max-h-56 overflow-auto rounded-lg border p-3 text-xs', testOut.ok ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-destructive/30 bg-destructive/5')}>
            {JSON.stringify(testOut.ok ? testOut.result : { error: testOut.error }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
