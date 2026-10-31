'use client';

// The autopilot's settings: who the email comes from, sandbox, daily limits,
// when it sends, and what it says Arvo does.
import { useState } from 'react';
import { CheckCircle2, CircleDashed, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { api, SectionTitle } from './shared';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Status({ ok, children }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span className={cn(!ok && 'text-muted-foreground')}>{children}</span>
    </li>
  );
}

function Num({ label, value, onChange, min = 0, max, step = 1, hint }) {
  return (
    <Field label={label}>
      <Input type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Field>
  );
}

export default function AutopilotSettings({ view, save, busy, reload }) {
  const [s, setS] = useState(view.settings);
  const [saved, setSaved] = useState(false);
  const [requeue, setRequeue] = useState('');
  const [testing, setTesting] = useState('');
  const c = view.config;

  const set = (patch) => (setSaved(false), setS((x) => ({ ...x, ...patch })));
  const setIn = (key, patch) => set({ [key]: { ...s[key], ...patch } });

  async function submit(e) {
    e.preventDefault();
    // The mode has its own switch at the top; don't put back an older value.
    const { mode, ...rest } = s;
    if (await save(rest)) setSaved(true);
  }

  async function sendForReal() {
    setRequeue('');
    try {
      const r = await api('/api/autopilot/prospects', { method: 'POST', body: { action: 'requeue_sandbox' } });
      setRequeue(r.requeued ? `${r.requeued} will get the real email.` : 'Nothing to send again.');
      await reload();
    } catch (err) {
      setRequeue(err.message);
    }
  }

  async function sendTest() {
    setTesting('Sending…');
    try {
      // Save first, so the test goes to the address on screen.
      const { mode, ...rest } = s;
      if (!(await save(rest))) return setTesting('');
      const r = await api('/api/autopilot/notify-test', { method: 'POST' });
      setTesting(`Sent (${r.sent.join(' and ')}). Check ${s.alertEmail || 'your inbox'}.`);
    } catch (err) {
      setTesting(err.message);
    }
  }

  const toggleDay = (d) => setIn('window', { days: s.window.days.includes(d) ? s.window.days.filter((x) => x !== d) : [...s.window.days, d].sort() });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <SectionTitle>Server setup</SectionTitle>
          <ul className="space-y-2">
            <Status ok={c.claude}>Claude ({view.model}) for research and writing: ANTHROPIC_API_KEY</Status>
            <Status ok={c.elevenlabs}>ElevenLabs key for building demos</Status>
            <Status ok={c.smtp}>Outreach mailbox for sending: ARVO_OUTREACH_SMTP_URL{c.sender ? ` (sends as ${c.sender})` : ''}</Status>
            <Status ok={c.imap}>Outreach mailbox for reading replies: ARVO_OUTREACH_IMAP_URL</Status>
            <Status ok={c.webhook}>Optional Slack or Discord alerts too: ARVO_NOTIFY_WEBHOOK</Status>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            These live in the server&apos;s environment (.env.local here; deploy with -SyncEnv). Use a separate domain for outreach, with SPF, DKIM and DMARC set up, never your main one.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SectionTitle>Who the email comes from</SectionTitle>
          </div>
          <Field label="Your name">
            <Input value={s.sender.name} onChange={(e) => setIn('sender', { name: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Title">
            <Input value={s.sender.title} onChange={(e) => setIn('sender', { title: e.target.value })} placeholder="Founder" maxLength={60} />
          </Field>
          <Field label="Company">
            <Input value={s.sender.company} onChange={(e) => setIn('sender', { company: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Replies go to">
            <Input type="email" value={s.sender.replyTo} onChange={(e) => setIn('sender', { replyTo: e.target.value })} placeholder="Same as the sending address" />
          </Field>
          <Field label="Postal address (optional; the law requires one only to email the US)" className="sm:col-span-2">
            <Input value={s.sender.address} onChange={(e) => setIn('sender', { address: e.target.value })} maxLength={200} placeholder="Leave empty to skip US markets" />
          </Field>
          <Field label="Public address of this dashboard (links point here)" className="sm:col-span-2">
            <Input value={s.publicUrl} onChange={(e) => set({ publicUrl: e.target.value })} placeholder="https://your-domain" disabled={c.publicUrlFromServer} />
            {c.publicUrlFromServer && <span className="text-xs text-muted-foreground">Set by the server (ARVO_PUBLIC_URL).</span>}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <SectionTitle>Notifications</SectionTitle>
          <p className="text-sm text-muted-foreground">
            An email here when a prospect replies with interest or tries their demo, and when something breaks. Sent from the outreach mailbox.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Send notifications to" className="min-w-[16rem] flex-1">
              <Input type="email" value={s.alertEmail} onChange={(e) => set({ alertEmail: e.target.value })} placeholder="you@gmail.com" />
            </Field>
            <Button type="button" variant="outline" onClick={sendTest} disabled={busy || !s.alertEmail}>
              Send a test
            </Button>
          </div>
          {testing && <p className="text-sm text-muted-foreground">{testing}</p>}
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Hot prospects and problems are always emailed. Optional:</p>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 accent-emerald-600" checked={s.alerts.daily} onChange={(e) => setIn('alerts', { daily: e.target.checked })} />
              Daily summary email (evening, India time)
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 accent-emerald-600" checked={s.alerts.weekly} onChange={(e) => setIn('alerts', { weekly: e.target.checked })} />
              Weekly report email
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <SectionTitle>Sandbox (hold sending)</SectionTitle>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-emerald-600" checked={s.sandbox} onChange={(e) => set({ sandbox: e.target.checked })} />
            <span>
              Hold all sending. Research, demos and drafts carry on, and approved emails wait here
              {view.held ? ` (${view.held} waiting now)` : ''}. Untick and save to start emailing companies, in their business hours and within the daily limits.
            </span>
          </label>
          {view.sandboxSent > 0 && !view.settings.sandbox && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>{view.sandboxSent} prospect{view.sandboxSent === 1 ? ' was' : 's were'} only emailed in sandbox.</span>
              <Button type="button" size="sm" variant="outline" onClick={sendForReal}>
                <RotateCcw /> Send them the real email
              </Button>
              {requeue && <span className="text-muted-foreground">{requeue}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <SectionTitle>Daily limits</SectionTitle>
          </div>
          <Num label="Emails per day (after warm-up)" value={s.caps.emails} onChange={(v) => setIn('caps', { emails: v })} max={300} />
          <Num label="Warm-up: first day" value={s.warmup.start} onChange={(v) => setIn('warmup', { start: v })} min={1} max={300} />
          <Num label="Warm-up: added each day" value={s.warmup.step} onChange={(v) => setIn('warmup', { step: v })} max={100} />
          <Num label="Claude spend per day ($)" value={s.spendUsd} onChange={(v) => set({ spendUsd: v })} step={0.5} max={200} />
          <Num label="Demos built per day" value={s.caps.demos} onChange={(v) => setIn('caps', { demos: v })} max={50} />
          <Num label="Websites qualified per day" value={s.caps.qualify} onChange={(v) => setIn('caps', { qualify: v })} max={200} />
          <Num label="Research runs per day" value={s.caps.researchRuns} onChange={(v) => setIn('caps', { researchRuns: v })} max={20} />
          <Num label="Minimum fit score" value={s.minFit} onChange={(v) => set({ minFit: v })} max={100} hint="0–100" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SectionTitle>When it sends (each recipient&apos;s local time)</SectionTitle>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:col-span-2" role="group" aria-label="Send days">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={s.window.days.includes(i)}
                className={cn(
                  'h-9 rounded-md border px-3 text-xs font-semibold transition',
                  s.window.days.includes(i) ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-input text-muted-foreground'
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <Num label="From (hour)" value={s.window.start} onChange={(v) => setIn('window', { start: v })} max={23} />
          <Num label="Until (hour)" value={s.window.end} onChange={(v) => setIn('window', { end: v })} min={1} max={24} />
          <Num label="Follow-up 1 after (days)" value={s.followupDays[0] ?? 3} onChange={(v) => set({ followupDays: [v, s.followupDays[1] ?? 7] })} min={1} max={60} />
          <Num label="Follow-up 2 after (days)" value={s.followupDays[1] ?? 7} onChange={(v) => set({ followupDays: [s.followupDays[0] ?? 3, v] })} min={1} max={60} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <Field label="What Arvo offers (the writer works from this)">
            <Textarea rows={4} value={s.product} onChange={(e) => set({ product: e.target.value })} maxLength={1200} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" />} Save settings
        </Button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</span>}
      </div>
    </form>
  );
}
