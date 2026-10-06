'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Inbox,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mic2,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input } from './controls';

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'No expiry' },
];

const FILTERS = [
  { id: 'all', label: 'All experiences' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

function expiresInDaysFor(choice) {
  return choice === 'never' ? null : Number(choice);
}

function clean(value, max) {
  return String(value || '')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function relativeTime(iso) {
  const time = Date.parse(iso || '');
  if (!time) return '—';
  const seconds = Math.floor((Date.now() - time) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function expiryLabel(iso) {
  if (!iso) return 'No expiry';
  const seconds = Math.floor((Date.parse(iso) - Date.now()) / 1000);
  if (seconds <= 0) return 'Expired';
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m left`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h left`;
  return `${Math.floor(seconds / 86400)}d left`;
}

const STATUS = {
  active: { label: 'Active', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  expired: { label: 'Expired', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  revoked: { label: 'Revoked', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
};

function StatusBadge({ status }) {
  const item = STATUS[status] || STATUS.expired;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset', item.cls)}>
      <span className={cn('size-1.5 rounded-full', item.dot)} /> {item.label}
    </span>
  );
}

function Field({ label, optional, children }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
        {optional && <span className="normal-case tracking-normal text-slate-400">Optional</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function CopyAction({ value, label = 'Copy link', compact = false }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permissions vary by browser; the URL remains selectable.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15',
        compact ? 'h-8 px-2.5 text-[10px]' : 'h-10 px-3 text-xs'
      )}
    >
      {copied ? <Check className="size-3.5 text-teal-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function CustomerPreview({ name }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0b1220] p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_50%_0%,rgba(37,99,235,.28),transparent_42%)]" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">Live customer preview</p>
          <h3 className="mt-1.5 text-base font-semibold text-white">No app. No login. One clear action.</h3>
        </div>
        <Smartphone className="size-5 text-slate-500" />
      </div>

      <div className="relative mx-auto mt-5 w-full max-w-[280px] rounded-[30px] border border-white/10 bg-[#f8fafc] p-2 shadow-[0_24px_55px_-25px_rgba(0,0,0,.8)]">
        <div className="overflow-hidden rounded-[23px] bg-white px-4 pb-5 pt-3 text-slate-950">
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-200" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-blue-600 text-white"><Mic2 className="size-3.5" /></span>
              <div>
                <p className="text-[9px] font-bold tracking-[-0.01em]">Loan INC</p>
                <p className="text-[7px] text-slate-400">Secure consultation</p>
              </div>
            </div>
            <LockKeyhole className="size-3.5 text-teal-600" />
          </div>
          <div className="mt-6 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-blue-50 text-blue-700"><UserRound className="size-4" /></span>
            <p className="mt-3 text-[13px] font-semibold">Hi {clean(name, 24) || 'Rohit'}</p>
            <p className="mx-auto mt-1 max-w-[190px] text-[8px] leading-3.5 text-slate-500">Your loan advisor is ready for a short, private conversation.</p>
            <button type="button" tabIndex={-1} className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-[9px] font-semibold text-white">
              <PhoneCall className="size-3" /> Start conversation
            </button>
          </div>
          <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-3">
            {[
              ['1', 'Understand your requirement'],
              ['2', 'Gather the basic profile'],
              ['3', 'Prepare the next step'],
            ].map(([number, label]) => (
              <div key={number} className="flex items-center gap-2 text-[8px] text-slate-500">
                <span className="grid size-4 place-items-center rounded-full border border-slate-200 bg-white text-[7px] font-semibold text-slate-600">{number}</span>
                {label}
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center justify-center gap-1 text-[7px] text-slate-400"><ShieldCheck className="size-2.5 text-teal-600" /> Never share an OTP, PIN, or password.</p>
        </div>
      </div>
    </div>
  );
}

function LinkReveal({ link, origin, onDismiss }) {
  const url = origin ? `${origin}${link.url}` : link.url;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
      <div className="pointer-events-none absolute right-0 top-0 size-40 translate-x-1/4 -translate-y-1/3 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-[0_10px_25px_-12px_rgba(37,99,235,.8)]"><Check className="size-5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-blue-600">Experience ready</p>
              <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-blue-950">Private room created for {link.customerName}</h3>
              <p className="mt-1 text-xs text-blue-800/70">Send the link directly or open it yourself to preview the customer journey.</p>
            </div>
          </div>
          <button type="button" onClick={onDismiss} className="text-xs font-medium text-blue-700 hover:text-blue-900">Dismiss</button>
        </div>
        <div className="mt-5 flex flex-col gap-2 rounded-xl border border-blue-200 bg-white p-2 sm:flex-row">
          <input readOnly value={url} onFocus={(event) => event.target.select()} className="h-10 min-w-0 flex-1 bg-transparent px-2 font-mono text-xs text-slate-600 outline-none" aria-label="Share link" />
          <CopyAction value={url} />
          <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800">
            Open preview <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ExperienceRow({ link, origin, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const url = origin ? `${origin}${link.url}` : link.url;

  async function revoke() {
    setRevoking(true);
    try {
      await onRevoke(link.token);
    } finally {
      setRevoking(false);
      setConfirming(false);
    }
  }

  return (
    <div className="grid gap-3 px-4 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1.4fr)_100px_110px_auto] sm:items-center sm:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><UserRound className="size-3.5" /></span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{link.customerName}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">{link.customerPhone || link.note || 'Private customer experience'}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between sm:block"><span className="text-[10px] text-slate-400 sm:hidden">Status</span><StatusBadge status={link.status} /></div>
      <div className="flex items-center justify-between text-xs sm:block">
        <span className="text-[10px] text-slate-400 sm:hidden">Activity</span>
        <p className="font-semibold text-slate-700">{link.callCount} call{link.callCount === 1 ? '' : 's'}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{expiryLabel(link.expiresAt)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
        <CopyAction value={url} compact />
        <a href={link.url} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700" aria-label={`Open experience for ${link.customerName}`}>
          <ExternalLink className="size-3.5" />
        </a>
        {link.status === 'active' && (confirming ? (
          <>
            <button type="button" onClick={revoke} disabled={revoking} className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-[10px] font-semibold text-white disabled:opacity-60">
              {revoking ? <LoaderCircle className="size-3 animate-spin" /> : null} Revoke
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={revoking} className="h-8 rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Revoke experience for ${link.customerName}`}><Ban className="size-3.5" /></button>
        ))}
      </div>
    </div>
  );
}

export default function LoanLinks({ onLinksChanged }) {
  const [links, setLinks] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [origin, setOrigin] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', note: '', expiry: '7' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [justCreated, setJustCreated] = useState(null);

  useEffect(() => setOrigin(window.location.origin), []);

  async function load() {
    try {
      setLoadError('');
      const response = await fetch('/api/loan/links', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load customer experiences.');
      setLinks(data.links || []);
      onLinksChanged?.(data.links || []);
    } catch (error) {
      setLoadError(error.message || String(error));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredLinks = useMemo(() => {
    if (!links) return [];
    if (filter === 'active') return links.filter((link) => link.status === 'active');
    if (filter === 'inactive') return links.filter((link) => link.status !== 'active');
    return links;
  }, [filter, links]);

  async function createLink(event) {
    event.preventDefault();
    const customerName = clean(form.customerName, 40);
    if (!customerName) {
      setCreateError('Add the customer name before creating the experience.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/loan/links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone: clean(form.customerPhone, 20),
          note: form.note.slice(0, 200),
          expiresInDays: expiresInDaysFor(form.expiry),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create the experience.');
      setJustCreated(data.link);
      setForm({ customerName: '', customerPhone: '', note: '', expiry: '7' });
      await load();
    } catch (error) {
      setCreateError(error.message || String(error));
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(token) {
    try {
      const response = await fetch(`/api/loan/links/${token}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not revoke the experience.');
      await load();
    } catch (error) {
      setLoadError(error.message || String(error));
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_45px_-38px_rgba(15,23,42,.5)] sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600"><Send className="size-3.5" /> Launch an experience</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-slate-950">Give one lead a private call room</h2>
              <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">Personalise the opening, set an expiry, then send one secure link. The agent uses your current live configuration.</p>
            </div>
            <span className="hidden rounded-xl bg-blue-50 p-2.5 text-blue-700 sm:block"><Link2 className="size-5" /></span>
          </div>

          <form onSubmit={createLink} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer name"><Input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Rohit Sharma" maxLength={40} autoComplete="off" /></Field>
              <Field label="Phone on file" optional><Input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="98765 43210" inputMode="tel" maxLength={20} autoComplete="off" /></Field>
            </div>
            <Field label="Internal note" optional><Input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="e.g. Home-loan enquiry from the website" maxLength={200} /></Field>
            <div className="grid gap-4 sm:grid-cols-[170px_1fr] sm:items-end">
              <Field label="Link expires">
                <select value={form.expiry} onChange={(event) => setForm((current) => ({ ...current, expiry: event.target.value }))} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15">
                  {EXPIRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Button type="submit" disabled={creating} className="w-full justify-center bg-blue-600 hover:bg-blue-700">
                {creating ? <LoaderCircle className="animate-spin" /> : <Plus />} {creating ? 'Creating experience' : 'Create private link'}
              </Button>
            </div>
            {createError && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"><TriangleAlert className="size-3.5" /> {createError}</p>}
            <p className="flex items-center gap-1.5 text-[10px] leading-4 text-slate-400"><LockKeyhole className="size-3" /> The note is operator-only. Customer identity is never placed in page metadata or link previews.</p>
          </form>
        </div>
        <CustomerPreview name={form.customerName} />
      </section>

      {justCreated && <LinkReveal link={justCreated} origin={origin} onDismiss={() => setJustCreated(null)} />}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_-28px_rgba(15,23,42,.4)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Experience ledger</p>
            <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">Customer links</h2>
          </div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-semibold transition', filter === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loadError && <p role="alert" className="m-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"><TriangleAlert className="size-3.5" /> {loadError}</p>}

        {links === null ? (
          <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin" /> Loading experiences…</div>
        ) : filteredLinks.length === 0 ? (
          <div className="grid min-h-52 place-items-center px-5 py-10 text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400"><Inbox className="size-5" /></span>
              <p className="mt-3 text-sm font-semibold text-slate-800">{filter === 'all' ? 'No customer experiences yet' : `No ${filter} experiences`}</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{filter === 'all' ? 'Create the first private link above and send it to a lead—or open it during a buyer demo.' : 'Choose another filter to see the rest of the ledger.'}</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_100px_110px_auto] gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:grid">
              <span>Customer</span><span>Status</span><span>Activity</span><span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredLinks.map((link) => <ExperienceRow key={link.token} link={link} origin={origin} onRevoke={revokeLink} />)}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[10px] text-slate-400">
              <span>{filteredLinks.length} experience{filteredLinks.length === 1 ? '' : 's'}</span>
              {links[0] && <span className="flex items-center gap-1"><Clock3 className="size-3" /> Latest {relativeTime(links[0].createdAt)}</span>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
