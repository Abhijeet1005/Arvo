'use client';

// The Autopilot: finds companies, builds each a demo, writes and sends the
// outreach, follows up and reads replies. This view is where the operator
// checks in: what it did, what waits for approval, and its settings.
import { useCallback, useEffect, useState } from 'react';
import { CircleDot, FlaskConical, LoaderCircle, Pause, Play, Radar, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { relativeTime } from '@/lib/demos/ui';
import { cn } from '@/lib/utils';
import { api, usd } from './shared';
import Overview from './Overview';
import ApprovalQueue from './ApprovalQueue';
import LinkedinQueue from './LinkedinQueue';
import Prospects from './Prospects';
import Markets from './Markets';
import AutopilotSettings from './AutopilotSettings';

const REFRESH_MS = 15000;

const MODES = [
  { id: 'paused', label: 'Paused', icon: Pause },
  { id: 'approve', label: 'Approve first', icon: ShieldCheck },
  { id: 'auto', label: 'Automatic', icon: Play },
];

function ModeSwitch({ mode, onChange, busy }) {
  return (
    <div role="radiogroup" aria-label="Autopilot mode" className="inline-flex rounded-lg border border-border bg-secondary/60 p-1">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          disabled={busy}
          onClick={() => mode !== id && onChange(id)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30',
            mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className={cn('size-3.5', mode === id && id === 'auto' && 'text-emerald-600', mode === id && id === 'paused' && 'text-amber-600')} />
          {label}
        </button>
      ))}
    </div>
  );
}

// What still needs setting up, in the order it matters.
function Setup({ view, onOpenSettings }) {
  const c = view.config;
  const items = [
    !c.claude && 'Add ANTHROPIC_API_KEY on the server. Research, qualifying and writing all need it.',
    !c.elevenlabs && 'Add the ElevenLabs API key (Loan advisor → Configuration) so demos can be built.',
    ...view.gaps,
    !c.imap && 'Optional: set ARVO_OUTREACH_IMAP_URL so replies stop follow-ups automatically.',
    !c.alerts && 'Add your email under Settings → Notifications to hear about hot prospects at once.',
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-500/20 dark:bg-amber-500/5">
      <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
        <TriangleAlert className="size-4" /> Before it can run fully
      </div>
      <ul className="space-y-1 text-amber-900/90 dark:text-amber-200/90">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onOpenSettings} className="mt-3 text-xs font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
        Open settings
      </button>
    </div>
  );
}

export default function AutopilotConsole() {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setView(await api('/api/autopilot'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function saveSettings(patch) {
    setBusy(true);
    try {
      setView(await api('/api/autopilot', { method: 'PATCH', body: patch }));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setNotice('');
    try {
      const r = await api('/api/autopilot/run', { method: 'POST' });
      setNotice(r.done?.length ? `Done: ${r.done.join(' · ')}` : 'Nothing to do right now.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setRunning(false);
      load();
    }
  }

  if (!view) {
    return (
      <div className="space-y-6">
        <PageHeader title="Autopilot" description="Finds companies, builds their demo, writes and sends the outreach, and follows up." />
        {error ? <p className="text-sm text-destructive">{error}</p> : <Skeleton className="h-40 w-full" />}
      </div>
    );
  }

  const s = view.settings;
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'approvals', label: 'Approvals', count: view.queue.length },
    { id: 'linkedin', label: 'LinkedIn', count: view.linkedin.length },
    { id: 'prospects', label: 'Prospects', count: view.totalProspects },
    { id: 'markets', label: 'Markets', count: view.markets.length },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Autopilot" description="Finds companies, builds their demo, writes and sends the outreach, and follows up.">
        <Button variant="outline" size="sm" onClick={runNow} disabled={running || s.mode === 'paused'} title={s.mode === 'paused' ? 'Choose a mode first' : 'Run one step of the pipeline now'}>
          {running ? <LoaderCircle className="animate-spin" /> : <Radar />}
          {running ? 'Running…' : 'Run now'}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ModeSwitch mode={s.mode} busy={busy} onChange={(mode) => saveSettings({ mode })} />
        {s.sandbox && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" title="Sending is on hold: nothing is emailed until Sandbox is turned off in Settings">
            <FlaskConical className="size-3.5" /> Sandbox: sending on hold{view.held ? ` (${view.held} ready)` : ''}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleDot className={cn('size-3.5', view.scheduler.running ? 'animate-pulse text-emerald-600' : 'text-muted-foreground')} />
          {s.mode === 'paused'
            ? 'Not running'
            : view.scheduler.running
              ? 'Working now'
              : view.scheduler.lastTickAt
                ? `Last run ${relativeTime(view.scheduler.lastTickAt)} · every ${view.scheduler.everyMinutes} min`
                : `Runs every ${view.scheduler.everyMinutes} min`}
        </span>
        <span className="text-xs text-muted-foreground">
          Claude today {usd(view.today.usd)} of {usd(s.spendUsd)}
        </span>
      </div>

      {s.mode === 'paused' && (
        <p className="text-sm text-muted-foreground">
          The autopilot is paused. Choose <strong className="text-foreground">Approve first</strong> to let it research, build demos and write drafts that you approve before anything is sent.
        </p>
      )}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Setup view={view} onOpenSettings={() => setTab('settings')} />

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1" aria-label="Autopilot sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition',
              tab === t.id ? 'border-emerald-600 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', t.id === 'approvals' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-secondary text-muted-foreground')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview view={view} onOpen={setTab} />}
      {tab === 'approvals' && <ApprovalQueue view={view} reload={load} />}
      {tab === 'linkedin' && <LinkedinQueue view={view} reload={load} />}
      {tab === 'prospects' && <Prospects view={view} reload={load} />}
      {tab === 'markets' && <Markets view={view} reload={load} />}
      {tab === 'settings' && <AutopilotSettings view={view} save={saveSettings} busy={busy} reload={load} />}
    </div>
  );
}
