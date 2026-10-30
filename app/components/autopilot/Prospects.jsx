'use client';

// Every company the autopilot has looked at, with where it stands.
import { useMemo, useState } from 'react';
import { ExternalLink, Flame, Mail, RotateCcw, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { relativeTime } from '@/lib/demos/ui';
import { STAGES } from '@/lib/autopilot/model';
import { api, Empty, FitBadge, hostOf, InMark, StageBadge } from './shared';

function lastActivity(p) {
  if (p.reply) return `Replied ${relativeTime(p.reply.at)}: ${p.reply.summary}`;
  if (p.engagedAt) return `Tried the demo ${relativeTime(p.engagedAt)}${p.demoCalls > 1 ? ` (${p.demoCalls} calls)` : ''}`;
  const last = p.emails[p.emails.length - 1];
  if (last) return `${last.kind === 'first' ? 'Emailed' : 'Followed up'} ${relativeTime(last.at)}${last.sandbox ? ' (sandbox)' : ''}`;
  if (p.stage === 'rejected' || p.stage === 'closed') return p.fit?.reason && p.stage === 'rejected' ? p.fit.reason : p.closedReason;
  if (p.error) return `${p.error.step}: ${p.error.message}`;
  return `Updated ${relativeTime(p.updatedAt)}`;
}

export default function Prospects({ view, reload }) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const markets = useMemo(() => Object.fromEntries(view.markets.map((m) => [m.id, m])), [view.markets]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return view.prospects.filter(
      (p) => (!stage || p.stage === stage) && (!q || p.name.toLowerCase().includes(q) || (p.website || '').toLowerCase().includes(q) || (p.email || '').includes(q))
    );
  }, [view.prospects, query, stage]);

  async function retry(id) {
    setError('');
    try {
      await api(`/api/autopilot/prospects/${id}`, { method: 'PATCH', body: { action: 'retry' } });
      await reload();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!view.prospects.length) {
    return <Empty icon={Users} title="No prospects yet">Research starts on the first run after a mode is chosen.</Empty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, website or email" className="pl-9" aria-label="Search prospects" />
        </div>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          aria-label="Filter by stage"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({view.funnel[s.id] || 0})
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {view.totalProspects > view.prospects.length && (
        <p className="text-xs text-muted-foreground">Showing the newest {view.prospects.length} of {view.totalProspects}.</p>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {list.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.name}</span>
                <StageBadge stage={p.stage} />
                <FitBadge fit={p.fit} />
                {p.engagedAt && <Flame className="size-4 text-orange-500" aria-label="Tried the demo" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {p.website && (
                  <a href={p.website} target="_blank" rel="noreferrer" className="hover:text-foreground">
                    {hostOf(p.website)}
                  </a>
                )}
                {markets[p.marketId] && <span>{markets[p.marketId].vertical}</span>}
                {p.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" /> {p.email}
                    {p.emailSource && <span>· found on {hostOf(p.emailSource)}</span>}
                  </span>
                )}
                {p.linkedin && (
                  <a href={p.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <InMark className="size-3.5 text-[8px]" /> LinkedIn
                  </a>
                )}
              </div>
              <p className="mt-1 break-words text-sm text-muted-foreground">{lastActivity(p)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {p.demoUrl && (
                <a href={p.demoUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold hover:border-emerald-400">
                  Demo <ExternalLink className="size-3.5" />
                </a>
              )}
              {p.stage === 'failed' && (
                <button type="button" onClick={() => retry(p.id)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold hover:border-emerald-400">
                  <RotateCcw className="size-3.5" /> Retry
                </button>
              )}
            </div>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-sm text-muted-foreground">No prospects match.</li>}
      </ul>
    </div>
  );
}
