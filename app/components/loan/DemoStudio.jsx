'use client';

// The demo factory: one branded demo per company you're talking to. Each demo
// has its own voice agent and its own link; this view creates them, shows who
// has tried theirs, and what the agent captured.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Inbox,
  Link2,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Button } from './controls';
import DemoForm from './DemoForm';
import DemoImport from './DemoImport';
import { downloadCsv } from '@/lib/demos/download';
import { brand } from '@/lib/demos/color';
import { publicResult } from '@/lib/demos/model';
import { durationLabel, expiryLabel, outcomeOf, pitchMessage, relativeTime, TONE_CLASSES, whatsappUrl } from '@/lib/demos/ui';
import { cn } from '@/lib/utils';

const REFRESH_MS = 8000;

// ---------------------------------------------------------------- pieces

function BrandTile({ business, className }) {
  const [broken, setBroken] = useState(false);
  const colours = brand(business.accent);
  if (business.logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={business.logoUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn('shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1', className)} />
    );
  }
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-xl text-base font-semibold', className)} style={{ backgroundColor: colours.accent, color: colours.ink }} aria-hidden="true">
      {(business.name || '?')[0].toUpperCase()}
    </span>
  );
}

function Chip({ children, className }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600', className)}>{children}</span>;
}

function CopyButton({ value, label = 'Copy link', title }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // The address stays selectable in its field.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15"
    >
      {copied ? <Check className="size-3.5 text-teal-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

const LINK_STATUS = {
  active: { label: 'Active', dot: 'bg-teal-500', text: 'text-teal-700' },
  full: { label: 'Call limit reached', dot: 'bg-amber-500', text: 'text-amber-700' },
  expired: { label: 'Expired', dot: 'bg-amber-500', text: 'text-amber-700' },
  revoked: { label: 'Turned off', dot: 'bg-slate-400', text: 'text-slate-500' },
};

function LinkRow({ link, origin, onRevoke, primary, demo }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = LINK_STATUS[link.status] || LINK_STATUS.expired;
  const url = `${origin}${link.url}`;
  const usable = link.status === 'active';
  const message = pitchMessage(demo.business.name, url);

  async function revoke() {
    setBusy(true);
    try {
      await onRevoke(link.token);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className={cn('rounded-xl border p-3', primary ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link2 className="size-3.5 shrink-0 text-slate-400" />
          <p className="truncate text-xs font-semibold text-slate-800">{link.label}</p>
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', status.text)}>
            <span className={cn('size-1.5 rounded-full', status.dot)} /> {status.label}
          </span>
        </div>
        <p className="text-[10px] text-slate-400">
          {link.sessions} of {link.maxSessions} calls · {expiryLabel(link.expiresAt)}
        </p>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label={`Link for ${link.label}`}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-[11px] text-slate-600 outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          <CopyButton value={url} />
          {usable && <CopyButton value={message} label="Copy message" title="A short note to send with the link" />}
          {usable && (
            <a
              href={whatsappUrl({ phone: demo.business.phone, language: demo.agent.language }, message)}
              target="_blank"
              rel="noopener noreferrer"
              title={demo.business.phone ? `Open WhatsApp to ${demo.business.phone}` : 'Open WhatsApp and choose who to send it to'}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          )}
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Open <ExternalLink className="size-3.5" />
          </a>
          {usable &&
            (confirming ? (
              <>
                <button type="button" onClick={revoke} disabled={busy} className="inline-flex h-9 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white disabled:opacity-60">
                  {busy ? <LoaderCircle className="size-3 animate-spin" /> : null} Turn off
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="h-9 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Turn off ${link.label}`}>
                <Ban className="size-3.5" />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function AddLink({ demoId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [max, setMax] = useState('6');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/demos/${demoId}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || 'Another link', maxSessions: Number(max) || 6 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not add the link.');
      setLabel('');
      setOpen(false);
      onAdded(data.demo);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900">
        <Plus className="size-3.5" /> Add another link
      </button>
    );
  }
  return (
    <form onSubmit={add} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] text-slate-500">Give each person their own link, so you can see who tried it and each has their own allowance of calls.</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Who is it for</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Rahul, owner" maxLength={40} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15" />
        </label>
        <label className="sm:w-28">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Calls allowed</span>
          <input value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15" />
        </label>
        <div className="flex gap-1.5">
          <Button type="submit" size="sm" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Plus />} Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}

function DemoCard({ demo, templates, industries, languages, origin, highlight, onEdit, onChanged, onActivity, notify }) {
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const template = templates.find((t) => t.id === demo.templateId);
  const industry = industries.find((i) => i.id === demo.industry);
  const language = languages.find((l) => l.id === demo.agent.language);
  // Links are listed newest first; the card features the original one so it
  // doesn't shuffle when more are added.
  const activeLinks = demo.links.filter((l) => l.status === 'active');
  const main = activeLinks[activeLinks.length - 1] || demo.links[demo.links.length - 1];
  const others = demo.links.filter((l) => l !== main);

  async function call(name, url, init, done) {
    setBusy(name);
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'That did not work.');
      if (data.warning) notify(data.warning, 'warn');
      done?.(data);
    } catch (e) {
      notify(e.message || String(e), 'error');
    } finally {
      setBusy('');
    }
  }

  const resync = () => call('sync', `/api/demos/${demo.id}/sync`, { method: 'POST' }, (data) => { onChanged(data.demo); notify('The agent is back in sync.', 'ok'); });
  const remove = () => call('delete', `/api/demos/${demo.id}`, { method: 'DELETE' }, () => onChanged(null, demo.id));
  const revoke = async (token) => {
    const response = await fetch(`/api/loan/links/${token}`, { method: 'DELETE' });
    if (!response.ok) notify('Could not turn that link off.', 'error');
    onChanged(undefined);
  };

  return (
    <article className={cn('overflow-hidden rounded-2xl border bg-white shadow-[0_10px_40px_-34px_rgba(15,23,42,.5)]', highlight ? 'border-blue-300 ring-4 ring-blue-500/10' : 'border-slate-200')}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <BrandTile business={demo.business} className="size-11" />
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{demo.business.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Chip>{template?.label || demo.templateId}</Chip>
              {demo.templateId === 'assistant' && industry && <Chip>{industry.label}</Chip>}
              <Chip>{language?.label || demo.agent.language}</Chip>
              <Chip>{demo.agent.name}</Chip>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {demo.agentReady ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
              <span className="size-1.5 rounded-full bg-teal-500" /> Agent live
            </span>
          ) : (
            <button type="button" onClick={resync} disabled={busy === 'sync'} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 disabled:opacity-60">
              {busy === 'sync' ? <LoaderCircle className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Agent not live · retry
            </button>
          )}
        </div>
      </header>

      <div className="space-y-3 px-5 py-4">
        {main ? <LinkRow link={main} origin={origin} onRevoke={revoke} primary demo={demo} /> : <p className="text-xs text-slate-500">This demo has no link yet.</p>}
        {others.length > 0 && (
          <>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800" aria-expanded={showAll}>
              <ChevronDown className={cn('size-3.5 transition-transform', showAll && 'rotate-180')} /> {others.length} other link{others.length === 1 ? '' : 's'}
            </button>
            {showAll && <div className="space-y-2">{others.map((link) => <LinkRow key={link.token} link={link} origin={origin} onRevoke={revoke} demo={demo} />)}</div>}
          </>
        )}
        <AddLink demoId={demo.id} onAdded={(updated) => onChanged(updated)} />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <button type="button" onClick={() => onActivity(demo.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700">
          <Clock3 className="size-3.5" />
          {demo.callCount === 0 ? 'No calls yet' : `${demo.callCount} call${demo.callCount === 1 ? '' : 's'} · last ${relativeTime(demo.lastCallAt)}`}
        </button>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => onEdit(demo)}><Pencil /> Edit</Button>
          {confirmDelete ? (
            <>
              <Button size="sm" variant="destructive" onClick={remove} disabled={busy === 'delete'}>
                {busy === 'delete' ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Delete demo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy === 'delete'}>Cancel</Button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${demo.business.name}`}>
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

// -------------------------------------------------------------- activity

const CALL_STATUS = {
  in_progress: 'On the call',
  processing: 'Preparing summary',
  failed: 'Failed',
};

function ActivityRow({ call, onRemove }) {
  const [open, setOpen] = useState(false);
  const card = call.status === 'done' ? publicResult(call) : null;
  const outcome = card ? outcomeOf(card.outcome) : null;
  const who = card?.callerName || call.customerName || '';
  const checks = Array.isArray(call.checks) ? call.checks : call.compliance ? [{ id: 'compliance', ...call.compliance }] : [];
  const flagged = checks.some((c) => c.result && c.result !== 'success');
  const rows = card ? [...(card.callerPhone && !card.fields.some((f) => f.key === 'caller_phone') ? [['Phone', card.callerPhone]] : []), ...card.fields.map((f) => [f.label, f.value])] : [];

  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{call.businessName || 'Demo'}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {call.linkLabel ? `${call.linkLabel} · ` : ''}
            {relativeTime(call.startedAt || call.createdAt)}
            {call.durationSecs ? ` · ${durationLabel(call.durationSecs)}` : ''}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {outcome ? (
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset', TONE_CLASSES[outcome.tone])}>{outcome.label}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              {call.status !== 'failed' && <LoaderCircle className="size-3 animate-spin" />}
              {call.status === 'done' ? 'No details captured' : CALL_STATUS[call.status] || 'Waiting'}
            </span>
          )}
          {who && <span className="truncate text-xs text-slate-600">{who}</span>}
          {flagged && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700"><TriangleAlert className="size-3" /> Check the answers</span>}
        </div>
        <ChevronDown className={cn('hidden size-4 text-slate-400 transition-transform sm:block', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-3 bg-slate-50/50 px-4 pb-4 pt-1 sm:px-5">
          {card?.title && <p className="text-xs font-semibold text-slate-800">{card.title}</p>}
          {rows.length > 0 && (
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={`${label}-${value}`} className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
                  <dd className="mt-0.5 break-words text-xs text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {card?.summary && <p className="text-xs leading-5 text-slate-600">{card.summary}</p>}
          {card?.notes && <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Note: </span>{card.notes}</p>}
          {checks.length > 0 && (
            <ul className="space-y-1">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[11px] leading-4 text-slate-500">
                  <span className={cn('mt-0.5 size-1.5 shrink-0 rounded-full', c.result === 'success' ? 'bg-teal-500' : c.result === 'failure' ? 'bg-red-500' : 'bg-amber-500')} />
                  <span><span className="font-semibold text-slate-700">{c.id === 'grounded' ? 'Stuck to what it knew' : c.id === 'safe' ? 'Handled safely' : 'Compliance'}: </span>{c.rationale || c.result}</span>
                </li>
              ))}
            </ul>
          )}
          {call.error && <p className="text-xs text-red-700">{call.error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={() => onRemove(call.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="size-3" /> Remove from the log
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Activity({ demos, calls, filter, onFilter, onRemove }) {
  const shown = filter ? calls.filter((c) => c.demoId === filter) : calls;
  return (
    <section id="demo-activity" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_-28px_rgba(15,23,42,.4)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Activity</p>
          <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">Who tried their demo</h2>
        </div>
        <select value={filter} onChange={(e) => onFilter(e.target.value)} aria-label="Filter by demo" className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15">
          <option value="">All demos</option>
          {demos.map((d) => <option key={d.id} value={d.id}>{d.business.name}</option>)}
        </select>
      </div>
      {shown.length === 0 ? (
        <div className="grid min-h-40 place-items-center px-5 py-10 text-center">
          <div>
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400"><Inbox className="size-5" /></span>
            <p className="mt-3 text-sm font-semibold text-slate-800">No calls yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">When someone opens a demo link and talks to the agent, the call appears here with what it captured.</p>
          </div>
        </div>
      ) : (
        <ul>{shown.map((call) => <ActivityRow key={call.id} call={call} onRemove={onRemove} />)}</ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- studio

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const tone = toast.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : toast.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-teal-200 bg-teal-50 text-teal-900';
  return (
    <div role="status" className={cn('mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm', tone)}>
      <span className="min-w-0 flex-1">{toast.text}</span>
      <button type="button" onClick={onClose} className="shrink-0 text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center sm:px-10">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Rocket className="size-6" /></span>
      <h2 className="mt-4 text-lg font-semibold tracking-[-0.025em] text-slate-950">Show a company their own AI voice agent</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Paste a company&apos;s website. Arvo sets up an agent that knows their business and gives you a link with their name and logo on it. They talk to it, then see the details it captured.
      </p>
      <div className="mx-auto mt-6 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[['1', 'Paste their website', 'Name, services, hours and logo are filled in for you.'], ['2', 'Send the link', 'One link per person, with a cap on calls.'], ['3', 'See what happens', 'You get the call, the summary and the lead.']].map(([n, title, body]) => (
          <div key={n} className="rounded-xl bg-slate-50 p-4">
            <span className="text-xs font-bold text-blue-600">{n}</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
          </div>
        ))}
      </div>
      <Button className="mt-7" size="lg" onClick={onNew}><Plus /> Create your first demo</Button>
    </section>
  );
}

export default function DemoStudio({ options, settings }) {
  const [meta, setMeta] = useState(null);
  const [demos, setDemos] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | a demo
  const [importing, setImporting] = useState(false);
  const [highlight, setHighlight] = useState('');
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [origin, setOrigin] = useState('');
  const mounted = useRef(true);

  useEffect(() => setOrigin(window.location.origin), []);

  const notify = useCallback((text, tone = 'ok') => setToast({ text, tone }), []);

  const load = useCallback(async () => {
    try {
      const [demoResponse, callResponse] = await Promise.all([
        fetch('/api/demos', { cache: 'no-store' }),
        fetch('/api/demos/calls', { cache: 'no-store' }),
      ]);
      const body = await demoResponse.json().catch(() => ({}));
      if (!demoResponse.ok) throw new Error(body.error || 'Could not load your demos.');
      const callBody = await callResponse.json().catch(() => ({}));
      if (!mounted.current) return;
      setMeta({ templates: body.templates, industries: body.industries, languages: body.languages, keyConfigured: body.keyConfigured, alerts: body.alerts, callPath: body.callPath });
      setDemos(body.demos);
      if (callResponse.ok) setCalls(callBody.calls || []);
      setLoadError('');
    } catch (e) {
      if (mounted.current) setLoadError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const changed = useCallback(
    (updated, removedId) => {
      if (removedId) {
        setDemos((list) => (list || []).filter((d) => d.id !== removedId));
        setCalls((list) => list.filter((c) => c.demoId !== removedId));
        setFilter((f) => (f === removedId ? '' : f));
        notify('Demo deleted. Its link no longer works.', 'ok');
      } else if (updated) {
        setDemos((list) => (list || []).map((d) => (d.id === updated.id ? updated : d)));
      }
      load();
    },
    [load, notify]
  );

  async function removeCall(id) {
    await fetch(`/api/loan/calls/${id}`, { method: 'DELETE' }).catch(() => null);
    setCalls((list) => list.filter((c) => c.id !== id));
  }

  const showActivity = useCallback((demoId) => {
    setFilter(demoId);
    requestAnimationFrame(() => document.getElementById('demo-activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const saved = useCallback(
    (demo, { created, warning }) => {
      setEditing(null);
      setDemos((list) => {
        const rest = (list || []).filter((d) => d.id !== demo.id);
        return created ? [demo, ...rest] : (list || []).map((d) => (d.id === demo.id ? demo : d));
      });
      setHighlight(created ? demo.id : '');
      if (warning) notify(warning, 'warn');
      else notify(created ? 'Demo created. Copy its link below and send it.' : 'Changes saved. The agent was updated.', 'ok');
      load();
    },
    [load, notify]
  );

  const sorted = useMemo(() => demos || [], [demos]);

  // One row per link, ready to mail-merge.
  const exportLinks = useCallback(() => {
    const rows = [['Company', 'For', 'Link', 'Status', 'Calls used', 'Calls allowed']];
    for (const demo of demos || []) {
      for (const link of demo.links) rows.push([demo.business.name, link.label, `${origin}${link.url}`, link.status, link.sessions, link.maxSessions]);
    }
    downloadCsv('demo-links.csv', rows);
  }, [demos, origin]);

  if (loadError && !demos) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <TriangleAlert className="mx-auto size-6 text-red-600" />
        <p className="mt-3 text-sm font-semibold text-slate-900">Could not open the demo factory</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{loadError}</p>
        <Button className="mt-4" onClick={load}>Try again</Button>
      </div>
    );
  }

  if (!demos || !meta) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <LoaderCircle className="size-4 animate-spin" /> Loading your demos…
      </div>
    );
  }

  if (importing) {
    return (
      <DemoImport
        meta={meta}
        existingNames={sorted.map((d) => d.business.name)}
        origin={origin}
        onClose={() => setImporting(false)}
        onFinished={load}
      />
    );
  }

  if (editing) {
    return (
      <DemoForm
        demo={editing === 'new' ? null : editing}
        meta={meta}
        options={options}
        settings={settings}
        onCancel={() => setEditing(null)}
        onSaved={saved}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_45px_-38px_rgba(15,23,42,.5)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600"><Sparkles className="size-3.5" /> Demo factory</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-slate-950">One branded AI agent per company you pitch</h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
            Each demo has its own voice agent that knows that company&apos;s business, and a link with their name and colours. Calls are capped, and you can turn any link off.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            {meta.alerts ? <Bell className="size-3.5 text-teal-600" /> : <BellOff className="size-3.5" />}
            {meta.alerts ? 'You get a message when someone calls and when the summary is ready.' : 'Alerts are off. Set ARVO_NOTIFY_WEBHOOK to a Slack or Discord webhook to get a message for every call.'}
          </p>
          {options?.subscription?.limit > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Voice credits: {options.subscription.used.toLocaleString()} of {options.subscription.limit.toLocaleString()} used
              {options.subscription.resetsAt ? `, renews ${new Date(options.subscription.resetsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}. A call uses credits for as long as it runs.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {sorted.length > 0 && (
            <Button variant="outline" onClick={exportLinks} title="Download every link as a spreadsheet"><Download /> Links</Button>
          )}
          <Button variant="outline" onClick={() => setImporting(true)}><FileUp /> Import a list</Button>
          <Button size="lg" onClick={() => setEditing('new')}><Plus /> New demo</Button>
        </div>
      </section>

      {sorted.length === 0 ? (
        <EmptyState onNew={() => setEditing('new')} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {sorted.map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              templates={meta.templates}
              industries={meta.industries}
              languages={meta.languages}
              origin={origin}
              highlight={highlight === demo.id}
              onEdit={(d) => setEditing(d)}
              onChanged={changed}
              onActivity={showActivity}
              notify={notify}
            />
          ))}
        </div>
      )}

      {sorted.length > 0 && <Activity demos={sorted} calls={calls} filter={filter} onFilter={setFilter} onRemove={removeCall} />}
    </div>
  );
}
