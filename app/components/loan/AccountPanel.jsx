'use client';

// Which ElevenLabs key the loan agent uses, how many credits are left, and a
// place to paste a new key when a test account runs out. The key itself is
// never sent back to the browser — only its last four characters.
import { useState } from 'react';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { Button, Input } from './controls';

function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function AccountPanel({ keyInfo, subscription, onChanged }) {
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { kind, text }

  async function send(method, body) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/loan/key', {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update the key.');
      setApiKey('');
      setNote({ kind: 'ok', text: method === 'PUT' ? 'Key saved. Now using this account.' : 'Switched back to the .env.local key.' });
      await onChanged?.();
    } catch (e) {
      setNote({ kind: 'warn', text: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  const used = subscription?.used ?? 0;
  const limit = subscription?.limit ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const low = limit > 0 && limit - used < limit * 0.15;

  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-secondary/60 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Active key</dt>
          <dd className="mt-1 text-sm">
            {keyInfo?.configured ? (
              <>
                <span className="font-mono">••••{keyInfo.last4}</span>{' '}
                <span className="text-muted-foreground">
                  {keyInfo.source === 'dashboard' ? '· set here' : '· from .env.local'}
                </span>
              </>
            ) : (
              <span className="text-destructive">None set</span>
            )}
          </dd>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credits</dt>
          <dd className="mt-1 space-y-1.5 text-sm">
            {subscription ? (
              <>
                <span className={low ? 'font-semibold text-destructive' : ''}>
                  {(limit - used).toLocaleString('en-IN')} left
                </span>{' '}
                <span className="text-muted-foreground">
                  of {limit.toLocaleString('en-IN')} · {subscription.tier} plan
                  {subscription.resetsAt ? ` · resets ${formatDate(subscription.resetsAt)}` : ''}
                </span>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
                  role="progressbar"
                  aria-label="Credits used"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={low ? 'h-full bg-red-500' : 'h-full bg-blue-600'} style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Not available for this key</span>
            )}
          </dd>
        </div>
      </dl>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (apiKey.trim()) send('PUT', { apiKey: apiKey.trim() });
        }}
      >
        <label htmlFor="el-api-key" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Use a different API key
        </label>
        <div className="flex gap-2">
          <Input
            id="el-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_…"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="el-api-key-hint"
          />
          <Button type="submit" variant="outline" disabled={busy || !apiKey.trim()}>
            {busy ? <LoaderCircle className="animate-spin" /> : null} Use key
          </Button>
        </div>
        <p id="el-api-key-hint" className="text-[11px] leading-snug text-muted-foreground">
          Validated with ElevenLabs, then saved on this deployment. The full key is never returned to the browser after saving. Voices belong to each account, so confirm the selected voice after switching.
        </p>
      </form>

      {keyInfo?.source === 'dashboard' && keyInfo.envAvailable && (
        <Button variant="ghost" size="sm" onClick={() => send('DELETE')} disabled={busy}>
          <RotateCcw /> Switch back to the .env.local key
        </Button>
      )}

      {note && (
        <p
          role={note.kind === 'warn' ? 'alert' : 'status'}
          className={note.kind === 'warn' ? 'text-sm text-destructive' : 'text-sm text-blue-700 dark:text-blue-400'}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
