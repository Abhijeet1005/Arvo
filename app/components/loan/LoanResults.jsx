'use client';

// Enterprise conversation ledger for call outcomes, borrower facts, compliance,
// and the exact end-of-call output returned by the analysis pipeline.
import { useState } from 'react';
import {
  Braces,
  Check,
  ChevronDown,
  Clock,
  Copy,
  LoaderCircle,
  PhoneOff,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './controls';

const OUTCOMES = {
  qualified: {
    label: 'Qualified',
    cls: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/25 dark:bg-teal-500/10 dark:text-teal-300',
    accent: 'border-l-teal-500',
  },
  callback: {
    label: 'Callback',
    cls: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300',
    accent: 'border-l-blue-600',
  },
  not_interested: {
    label: 'Not interested',
    cls: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    accent: 'border-l-slate-400 dark:border-l-slate-600',
  },
  wrong_number: {
    label: 'Wrong number',
    cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
    accent: 'border-l-amber-500',
  },
  dnc: {
    label: 'Do not call',
    cls: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
    accent: 'border-l-red-500',
  },
};

const CALL_STATES = {
  in_progress: {
    label: 'In progress',
    cls: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300',
    dot: 'bg-blue-600',
    accent: 'border-l-blue-600',
  },
  processing: {
    label: 'Processing',
    cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-500',
  },
  failed: {
    label: 'Failed',
    cls: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
    dot: 'bg-red-500',
    accent: 'border-l-red-500',
  },
  done: {
    label: 'Completed',
    cls: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
    dot: 'bg-teal-500',
    accent: 'border-l-slate-300 dark:border-l-slate-700',
  },
};

const LEDGER_COLUMNS =
  'md:grid-cols-[minmax(0,1.45fr)_minmax(7.25rem,0.65fr)_minmax(8.25rem,0.75fr)_minmax(6.5rem,0.55fr)_minmax(8rem,auto)]';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'callback', label: 'Callback' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'processing', label: 'Processing' },
];

function matchesFilter(call, filter) {
  if (filter === 'all') return true;
  if (filter === 'processing') return call.status === 'in_progress' || call.status === 'processing';
  if (filter === 'attention') {
    return call.status === 'failed' || call.result?.needs_human_review || call.result?.do_not_call || (call.compliance && call.compliance.result !== 'success');
  }
  return call.result?.outcome === filter;
}

function Pill({ className, children }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold leading-none',
        className
      )}
    >
      {children}
    </span>
  );
}

function rupees(n) {
  return Number(n) > 0 ? `₹${Number(n).toLocaleString('en-IN')}` : '';
}

function timeAgo(iso) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function duration(secs) {
  const n = Math.round(Number(secs) || 0);
  if (!n) return '';
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

function initials(value) {
  return String(value || 'Unknown caller')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function Facts({ r }) {
  const facts = [
    ['Purpose', r.purpose],
    ['Amount', rupees(r.amount)],
    ['Monthly income', rupees(r.monthly_income)],
    ['Employment', r.employment_type],
    ['Company / business', r.company_or_business],
    ['Age', r.age > 0 ? String(r.age) : ''],
    ['City', r.city],
    ['Residence', r.residence_type],
    ['Property', r.property_owned],
    ['Existing EMIs', r.existing_emis],
    ['Credit score', [r.cibil_score, r.cibil_last_checked && `checked ${r.cibil_last_checked}`].filter(Boolean).join(' · ')],
    ['PAN', r.pan_number],
    ['Phone', r.phone],
    ['Callback', r.callback_time],
  ].filter(([, value]) => value);

  if (facts.length === 0) return null;
  return (
    <section aria-label="Structured borrower facts">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
          Borrower profile
        </h4>
        <span className="text-[11px] tabular-nums text-muted-foreground">{facts.length} fields captured</span>
      </div>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-3 dark:border-slate-800 dark:bg-slate-800">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0 bg-white px-3 py-2.5 dark:bg-slate-950">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words text-[13px] font-medium text-slate-900 dark:text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PolicyBadge({ call }) {
  if (call.compliance) {
    return call.compliance.result === 'success' ? (
      <Pill className="border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/25 dark:bg-teal-500/10 dark:text-teal-300">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Passed
      </Pill>
    ) : (
      <Pill className="border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
        <ShieldAlert className="size-3.5" aria-hidden="true" /> Flagged
      </Pill>
    );
  }

  if (call.status === 'in_progress' || call.status === 'processing') {
    return (
      <Pill className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Awaiting result
      </Pill>
    );
  }

  return (
    <Pill className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      Not checked
    </Pill>
  );
}

function StateNotice({ call }) {
  if (call.status === 'in_progress' || call.status === 'processing') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/15 dark:bg-blue-500/10 dark:text-blue-200 sm:px-5"
      >
        <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        {call.status === 'processing'
          ? 'Call ended — building the profile from the conversation…'
          : 'Call in progress…'}
      </div>
    );
  }

  if (call.status === 'failed') {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 border-b border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-800 dark:border-red-500/15 dark:bg-red-500/10 dark:text-red-300 sm:px-5"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {call.error || 'This call could not be processed.'}
      </div>
    );
  }

  if (call.status === 'done' && !call.result) {
    return (
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:px-5">
        <PhoneOff className="size-4 shrink-0" aria-hidden="true" />
        No profile captured — the call was too short.
      </div>
    );
  }

  return null;
}

function SupportingDetails({ call, r }) {
  const rationale = call.compliance?.rationale;
  if (!call.summary && !r.notes && !rationale) return null;

  return (
    <aside className="space-y-4 lg:border-l lg:border-slate-200 lg:pl-6 dark:lg:border-slate-800">
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
        Decision trail
      </h4>
      {call.summary && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Conversation summary</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{call.summary}</p>
        </div>
      )}
      {r.notes && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Advisor notes</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{r.notes}</p>
        </div>
      )}
      {rationale && (
        <div
          className={cn(
            'border-l-2 py-0.5 pl-3',
            call.compliance?.result === 'success' ? 'border-teal-500' : 'border-red-500'
          )}
        >
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              call.compliance?.result === 'success'
                ? 'text-teal-700 dark:text-teal-300'
                : 'text-red-700 dark:text-red-300'
            )}
          >
            Policy rationale
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{rationale}</p>
        </div>
      )}
    </aside>
  );
}

function CallRow({ call, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const r = call.result;
  const outcome = r ? OUTCOMES[r.outcome] : null;
  const state = CALL_STATES[call.status] || CALL_STATES.done;
  const pending = call.status === 'in_progress' || call.status === 'processing';
  const json = r ? JSON.stringify(r, null, 2) : '';
  const name = r?.name || call.customerName || 'Unknown caller';
  const started = call.startedAt || call.createdAt;
  const elapsed = duration(call.durationSecs);
  const detailsId = `call-details-${String(call.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const hasSupportingDetails = Boolean(r && (call.summary || r.notes || call.compliance?.rationale));
  const complianceFlagged = Boolean(call.compliance && call.compliance.result !== 'success');
  const criticalAttention = call.status === 'failed' || complianceFlagged || r?.do_not_call;
  const rowAccent = criticalAttention
    ? 'border-l-red-500'
    : r?.needs_human_review
      ? 'border-l-amber-500'
      : outcome?.accent || state.accent;

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await onRemove(call.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <article className={cn('border-l-2 bg-white dark:bg-slate-950', rowAccent)}>
      <div className={cn('grid grid-cols-2 items-center gap-x-3 gap-y-4 px-4 py-4 sm:px-5 md:gap-4 md:py-3.5', LEDGER_COLUMNS)}>
        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{name}</p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('size-1.5 shrink-0 rounded-full', state.dot, pending && 'animate-pulse')} aria-hidden="true" />
              <span className="shrink-0">{state.label}</span>
              {call.title && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{call.title}</span>
                </>
              )}
            </div>
            {(r?.needs_human_review || (r?.do_not_call && r.outcome !== 'dnc')) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.needs_human_review && (
                  <Pill className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                    <TriangleAlert className="size-3" aria-hidden="true" /> Needs review
                  </Pill>
                )}
                {r.do_not_call && r.outcome !== 'dnc' && (
                  <Pill className={OUTCOMES.dnc.cls}>
                    <PhoneOff className="size-3" aria-hidden="true" /> Do not call
                  </Pill>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">Outcome</p>
          <Pill className={(outcome || state).cls}>{(outcome || state).label}</Pill>
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">Policy check</p>
          <PolicyBadge call={call} />
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">Timing</p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{timeAgo(started) || '—'}</p>
          {elapsed && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" /> {elapsed}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-500/10"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailsId}
          >
            {expanded ? 'Close' : 'Details'}
            <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          </Button>
          {confirmingRemove ? (
            <div className="flex items-center gap-1">
              <span className="hidden text-[10px] text-slate-400 xl:inline">Remove log?</span>
              <Button type="button" variant="destructive" size="sm" className="h-8 px-2 text-[10px]" onClick={remove} disabled={removing}>
                {removing ? <LoaderCircle className="animate-spin" /> : null} Remove
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[10px]" onClick={() => setConfirmingRemove(false)} disabled={removing}>Cancel</Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={() => setConfirmingRemove(true)}
              disabled={removing}
              aria-label="Remove call from the local activity log"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div id={detailsId} className="border-t border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/45">
          <StateNotice call={call} />
          {r && (
            <div className="px-4 py-5 sm:px-5">
              <div
                className={cn(
                  'grid gap-6',
                  hasSupportingDetails && 'lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,0.8fr)]'
                )}
              >
                <Facts r={r} />
                <SupportingDetails call={call} r={r} />
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">End-of-call output</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Machine-readable record for audit and integrations.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setShowJson((value) => !value)}
                    aria-expanded={showJson}
                  >
                    <Braces /> {showJson ? 'Hide raw JSON' : 'Show raw JSON'}
                  </Button>
                </div>

                {showJson && (
                  <div className="mt-3 space-y-2.5">
                    <div className="relative">
                      <pre className="max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 pr-24 text-[12px] leading-relaxed text-slate-100">
                        {json}
                      </pre>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute right-2 top-2 h-8"
                        onClick={copy}
                        aria-label="Copy JSON"
                      >
                        {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      PAN is masked to the last four characters in this dashboard.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function LoanResults({ calls, onRemove }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCalls = calls.filter((call) => {
    if (!matchesFilter(call, filter)) return false;
    if (!normalizedQuery) return true;
    return [call.customerName, call.result?.name, call.result?.phone, call.result?.purpose, call.title]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  return (
    <section aria-labelledby="conversation-ledger-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-34px_rgba(15,23,42,.5)]">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Retained activity</p>
            <h2 id="conversation-ledger-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">Conversation ledger</h2>
            <p className="mt-1 text-xs text-slate-500">Call outcomes, borrower data, and conversation-policy results in one inspectable trail.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or purpose" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
            </label>
            <span className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-semibold tabular-nums text-slate-500">{filteredCalls.length} of {calls.length}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-fit">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={cn('shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition', filter === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">No conversations yet</p>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">Run a rehearsal or share a customer experience. Analysed calls appear here with the borrower profile, policy check, and structured output.</p>
        </div>
      ) : filteredCalls.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">No conversations match this view</p>
          <p className="mt-1 text-xs text-slate-500">Clear the search or choose another filter.</p>
          <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="mt-4 text-xs font-semibold text-blue-700 hover:text-blue-600">Clear filters</button>
        </div>
      ) : (
        <>
          <div className={cn('hidden border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:grid md:items-center md:gap-4', LEDGER_COLUMNS)} aria-hidden="true">
            <span>Conversation</span><span>Outcome</span><span>Policy check</span><span>Timing</span><span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredCalls.map((call) => <CallRow key={call.id} call={call} onRemove={onRemove} />)}
          </div>
        </>
      )}
    </section>
  );
}
