'use client';

// The markets the autopilot researches: how each is doing, what it learned
// about them, and the switch to test, scale or pause one.
import { useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { api, SectionTitle } from './shared';

const STATUS = [
  { id: 'active', label: 'Active', hint: 'Gets most of the research' },
  { id: 'testing', label: 'Testing', hint: 'Gets a small share until it proves itself' },
  { id: 'paused', label: 'Paused', hint: 'No new research' },
];

const INDUSTRY = [
  { id: 'generic', label: 'Any business' },
  { id: 'realestate', label: 'Real estate' },
  { id: 'homeservices', label: 'Home services' },
];

const selectClass =
  'h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20';

function Market({ m, reload }) {
  const [busy, setBusy] = useState(false);
  const s = m.stats;
  async function setStatus(status) {
    setBusy(true);
    try {
      await api('/api/autopilot/markets', { method: 'PATCH', body: { id: m.id, status } });
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className={cn(m.status === 'paused' && 'opacity-70')}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{m.vertical}</h3>
            <p className="text-xs text-muted-foreground">{m.city}</p>
          </div>
          <select value={m.status} onChange={(e) => setStatus(e.target.value)} disabled={busy} className={selectClass} aria-label={`Status of ${m.vertical}`}>
            {STATUS.map((x) => (
              <option key={x.id} value={x.id} title={x.hint}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          {[
            ['Found', s.found],
            ['Not a fit', s.rejected],
            ['Emailed', s.sent],
            ['Replied', s.replied],
            ['Tried demo', s.engaged],
            // With nothing sent the rate is only the starting estimate.
            ['Win rate', s.sent ? `${(m.winRate * 100).toFixed(1)}%` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-secondary/60 px-2 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums">{value ?? 0}</dd>
            </div>
          ))}
        </dl>
        {m.brief ? (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">What research learned</summary>
            <p className="mt-2 whitespace-pre-line text-sm">{m.brief}</p>
          </details>
        ) : (
          <p className="text-xs text-muted-foreground">Not researched yet.</p>
        )}
        {m.note && <p className="text-xs text-muted-foreground">Why it was added: {m.note}</p>}
      </CardContent>
    </Card>
  );
}

function AddMarket({ reload }) {
  const [form, setForm] = useState({ vertical: '', city: 'Delhi NCR', industry: 'generic' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/autopilot/markets', { method: 'POST', body: form });
      setForm((f) => ({ ...f, vertical: '' }));
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="p-5">
        <SectionTitle>Add a market</SectionTitle>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Kind of business">
            <Input value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} placeholder="e.g. Dental clinics" required maxLength={120} />
          </Field>
          <Field label="City or region">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required maxLength={80} />
          </Field>
          <Field label="Demo preset">
            <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={selectClass}>
              {INDUSTRY.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Plus />} Add
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          New markets start as Testing. Each weekly review pauses markets with no response after 100 emails, promotes ones that do as well as the best, and may add one new market to test.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Markets({ view, reload }) {
  return (
    <div className="space-y-4">
      {view.markets.map((m) => (
        <Market key={m.id} m={m} reload={reload} />
      ))}
      <AddMarket reload={reload} />
    </div>
  );
}
