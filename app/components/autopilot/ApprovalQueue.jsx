'use client';

// Drafts waiting for the operator: each prospect with why it fits, its demo,
// and the emails the autopilot wrote. Approve as is, edit first, or reject.
import { useState } from 'react';
import { CheckCheck, ExternalLink, Globe, Inbox, LoaderCircle, Mail, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { api, Empty, FitBadge, hostOf, InMark } from './shared';

function Draft({ p, settings, reload }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.draft);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function act(action, extra = {}) {
    setBusy(action);
    setError('');
    try {
      await api(`/api/autopilot/prospects/${p.id}`, { method: 'PATCH', body: { action, ...extra } });
      if (action === 'edit') setEditing(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const followupDays = settings.followupDays;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setFollowup = (i, body) => setDraft((d) => ({ ...d, followups: d.followups.map((f, j) => (j === i ? { body } : f)) }));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{p.name}</h3>
              <FitBadge fit={p.fit} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <Globe className="size-3.5" /> {hostOf(p.website)}
              </a>
              {p.city && <span>{p.city}</span>}
              {p.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" /> {p.email}
                  {p.emailSource && <span>(found on {hostOf(p.emailSource)})</span>}
                </span>
              )}
              {p.linkedin && (
                <a href={p.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <InMark /> LinkedIn
                </a>
              )}
            </div>
          </div>
          {p.demoUrl && (
            <a href={p.demoUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold hover:border-emerald-400">
              Try their demo <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {(p.fit?.reason || p.hook) && (
          <div className="rounded-lg bg-secondary/60 p-3 text-sm">
            {p.fit?.reason && <p>{p.fit.reason}</p>}
            {p.hook && <p className="mt-1 text-muted-foreground">Opening detail: {p.hook}</p>}
          </div>
        )}

        {!p.email && <p className="text-sm text-muted-foreground">No public email address was found, so this one goes out on LinkedIn only.</p>}

        {editing ? (
          <div className="space-y-3">
            <Field label="Subject">
              <Input value={draft.subject} onChange={(e) => set({ subject: e.target.value })} maxLength={120} />
            </Field>
            <Field label="First email">
              <Textarea rows={8} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
            </Field>
            {draft.followups.map((f, i) => (
              <Field key={i} label={`Follow-up ${i + 1} (day ${followupDays[i] ?? '?'})`}>
                <Textarea rows={4} value={f.body} onChange={(e) => setFollowup(i, e.target.value)} />
              </Field>
            ))}
            <Field label={`LinkedIn note (${draft.linkedin.length}/300)`}>
              <Textarea rows={3} value={draft.linkedin} maxLength={300} onChange={(e) => set({ linkedin: e.target.value })} />
            </Field>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {p.email && (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 font-semibold">{p.draft.subject}</div>
                <p className="whitespace-pre-line">{p.draft.body}</p>
              </div>
            )}
            {p.email && (
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Follow-ups (sent only if there's no reply)</summary>
                {p.draft.followups.map((f, i) => (
                  <div key={i} className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground">Day {followupDays[i] ?? '?'}</div>
                    <p className="mt-1 whitespace-pre-line">{f.body}</p>
                  </div>
                ))}
              </details>
            )}
            {p.linkedin && (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <InMark /> LinkedIn note
                </div>
                <p>{p.draft.linkedin}</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={() => act('edit', { draft })} disabled={Boolean(busy)}>
                {busy === 'edit' && <LoaderCircle className="animate-spin" />} Save changes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => (setDraft(p.draft), setEditing(false))} disabled={Boolean(busy)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => act('approve')} disabled={Boolean(busy)}>
                {busy === 'approve' ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={Boolean(busy)}>
                <Pencil /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act('reject')} disabled={Boolean(busy)}>
                {busy === 'reject' ? <LoaderCircle className="animate-spin" /> : <X />} Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApprovalQueue({ view, reload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const queue = view.queue;

  async function approveAll() {
    setBusy(true);
    setError('');
    try {
      await api('/api/autopilot/prospects', { method: 'POST', body: { action: 'approve', ids: queue.map((p) => p.id) } });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!queue.length) {
    return (
      <Empty icon={Inbox} title="Nothing waiting for you">
        {view.settings.mode === 'auto' ? 'In automatic mode drafts are approved as soon as they are written.' : 'New drafts appear here as soon as the autopilot writes them.'}
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {view.settings.sandbox
            ? 'Sending is on hold (Sandbox): approved emails wait until it is turned off.'
            : 'Approved emails go out in each recipient’s business hours, a few minutes apart.'}
        </p>
        <Button size="sm" onClick={approveAll} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Approve all {queue.length}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {queue.map((p) => (
        <Draft key={`${p.id}-${p.updatedAt}`} p={p} settings={view.settings} reload={reload} />
      ))}
    </div>
  );
}
