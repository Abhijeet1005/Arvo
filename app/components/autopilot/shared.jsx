'use client';

// Small pieces shared by the Autopilot views.
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stageLabel } from '@/lib/autopilot/model';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

const STAGE_TONES = {
  found: 'bg-secondary text-muted-foreground',
  qualified: 'bg-secondary text-foreground',
  demo_ready: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  drafted: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  approved: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
  sent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  followup_1: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  followup_2: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  replied: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  engaged: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  unsubscribed: 'bg-secondary text-muted-foreground',
  bounced: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  rejected: 'bg-secondary text-muted-foreground',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  closed: 'bg-secondary text-muted-foreground',
};

export function StageBadge({ stage, className }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', STAGE_TONES[stage] || STAGE_TONES.found, className)}>
      {stageLabel(stage)}
    </span>
  );
}

export function FitBadge({ fit }) {
  if (!fit) return null;
  const tone = fit.score >= 80 ? 'text-emerald-700 dark:text-emerald-300' : fit.score >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground';
  return (
    <span className={cn('text-xs font-semibold tabular-nums', tone)} title={fit.reason}>
      {fit.score}/100
    </span>
  );
}

// LinkedIn has no icon in this icon set; a small "in" mark reads the same.
export function InMark({ className }) {
  return (
    <span aria-hidden="true" className={cn('inline-grid size-4 place-items-center rounded-[3px] bg-[#0a66c2] text-[9px] font-bold leading-none text-white', className)}>
      in
    </span>
  );
}

export function CopyButton({ value, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // The text stays visible to copy by hand.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold transition hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30',
        className
      )}
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {Icon && <Icon className="size-6 text-muted-foreground" />}
      <div className="text-sm font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
