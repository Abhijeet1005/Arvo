'use client';

import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Headphones,
  IndianRupee,
  Link2,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { LANGUAGES, providerOf } from '@/lib/loan/options';
import { cn } from '@/lib/utils';

function duration(secs) {
  const n = Math.round(Number(secs) || 0);
  if (!n) return '—';
  return `${Math.floor(n / 60)}m ${n % 60}s`;
}

function Metric({ icon: Icon, label, value, supporting, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    teal: 'bg-teal-50 text-teal-700 ring-teal-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</p>
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.045em] text-slate-950 tabular-nums">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{supporting}</p>
        </div>
        <span className={cn('grid size-9 place-items-center rounded-xl ring-1', tones[tone])}>
          <Icon className="size-[17px]" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

const OUTCOMES = {
  qualified: { label: 'Qualified', cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
  callback: { label: 'Callback', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  not_interested: { label: 'Not interested', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  wrong_number: { label: 'Wrong number', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  dnc: { label: 'Do not call', cls: 'bg-red-50 text-red-700 ring-red-200' },
};

function Outcome({ outcome, status }) {
  if (!outcome) {
    const processing = status === 'processing' || status === 'in_progress';
    return (
      <span className={cn('inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset', processing ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-600 ring-slate-200')}>
        {processing ? 'Processing' : status || 'Pending'}
      </span>
    );
  }
  const item = OUTCOMES[outcome] || OUTCOMES.callback;
  return <span className={cn('inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset', item.cls)}>{item.label}</span>;
}

function Hero({ settings, keyConfigured, onNavigate }) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <div className="relative min-h-[360px] min-w-0 overflow-hidden rounded-[28px] bg-[#0b1220] p-6 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,.85)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_72%_20%,rgba(37,99,235,.32),transparent_33%),radial-gradient(circle_at_90%_80%,rgba(20,184,166,.18),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex h-full max-w-2xl flex-col">
          <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-200">
            <Sparkles className="size-3.5" /> Automated first conversation
          </div>
          <h2 className="mt-7 max-w-xl text-3xl font-semibold leading-[1.05] tracking-[-0.05em] sm:text-4xl lg:text-[46px]">
            Every loan enquiry gets a quality conversation while it is still warm.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]">
            {settings.agentName} qualifies intent, captures a clean borrower profile, applies your guardrails, and prepares a human-ready handoff.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={() => onNavigate('experiences')} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,.9)] transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/30 sm:w-auto">
              <Link2 className="size-4" /> Create a customer link
            </button>
            <button type="button" onClick={() => onNavigate('conversations')} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10 sm:w-auto">
              <Headphones className="size-4" /> Rehearse the call
            </button>
          </div>
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_-38px_rgba(15,23,42,.45)] sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Customer journey</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">What buyers can experience</p>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset', keyConfigured ? 'bg-teal-50 text-teal-700 ring-teal-200' : 'bg-amber-50 text-amber-700 ring-amber-200')}>
            <span className={cn('size-1.5 rounded-full', keyConfigured ? 'bg-teal-500' : 'bg-amber-500')} />
            {keyConfigured ? 'Ready to demo' : 'Needs account'}
          </span>
        </div>

        <div className="relative mt-5 space-y-1">
          {[
            { icon: MessageSquareText, title: 'A private call room opens', text: 'Personalised, branded, and no login required.' },
            { icon: PhoneCall, title: 'The conversation runs live', text: 'Voice activity and progress are visible—not the raw transcript.' },
            { icon: FileCheck2, title: 'A borrower profile is built', text: 'Purpose, amount, employment, income, and callback preference.' },
            { icon: UserCheck, title: 'Your team gets the handoff', text: 'Outcome, notes, compliance result, and structured call data.' },
          ].map((step, index, steps) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                {index < steps.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-1.4rem)] w-px bg-slate-200" />}
                <span className="relative z-10 grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                  <Icon className="size-4" />
                </span>
                <div className="pt-0.5">
                  <p className="text-[13px] font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Funnel({ calls }) {
  const profiled = calls.filter((call) => call.result).length;
  const qualified = calls.filter((call) => call.result?.outcome === 'qualified').length;
  const compliant = calls.filter((call) => call.compliance?.result === 'success').length;
  const values = [
    { label: 'Conversations', value: calls.length, icon: PhoneCall },
    { label: 'Profiles captured', value: profiled, icon: Users },
    { label: 'Qualified', value: qualified, icon: UserCheck },
    { label: 'Compliant', value: compliant, icon: ShieldCheck },
  ];
  const max = Math.max(calls.length, 1);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Outcome pipeline</p>
          <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-slate-950">From conversation to handoff</h3>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">All time</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {values.map((item, index) => {
          const Icon = item.icon;
          const pct = Math.max(item.value > 0 ? 12 : 3, Math.round((item.value / max) * 100));
          return (
            <div key={item.label} className="relative min-w-0 rounded-xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-100">
              <div className="flex items-center justify-between">
                <Icon className="size-4 text-slate-400" />
                {index < values.length - 1 && <ChevronRight className="hidden size-3.5 text-slate-300 sm:block" />}
              </div>
              <p className="mt-4 text-xl font-semibold tracking-[-0.04em] text-slate-900 tabular-nums">{item.value}</p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{item.label}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function AgentReadiness({ settings, options, keyConfigured, onNavigate }) {
  const voice = (options?.voices || []).find((item) => item.id === settings.voiceId);
  const language = LANGUAGES.find((item) => item.id === settings.language)?.label || settings.language;
  const checks = [
    { label: 'ElevenLabs account', ok: keyConfigured },
    { label: 'Voice selected', ok: Boolean(settings.voiceId) },
    { label: 'Compliance policy', ok: true },
    { label: 'Post-call profile', ok: true },
  ];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Active deployment</p>
          <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-slate-950">{settings.agentName}</h3>
          <p className="mt-1 text-xs text-slate-500">{settings.companyName} · Loan qualification</p>
        </div>
        <span className="relative grid size-10 place-items-center rounded-xl bg-[#0b1220] text-white">
          <Bot className="size-[18px]" />
          <span className={cn('absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white', keyConfigured ? 'bg-teal-500' : 'bg-amber-500')} />
        </span>
      </div>

      <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
        {[
          ['Voice', voice?.name || 'Selected voice'],
          ['Language', settings.language === 'hi' && settings.hinglishMode ? 'Hinglish' : language],
          ['Model', `${settings.llm} · ${providerOf(settings.llm)}`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <dt className="text-slate-500">{label}</dt>
            <dd className="max-w-[65%] truncate text-right font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {checks.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-medium text-slate-600">
            {item.ok ? <Check className="size-3.5 text-teal-600" /> : <span className="size-3.5 rounded-full border-2 border-amber-400" />}
            {item.label}
          </div>
        ))}
      </div>

      <button type="button" onClick={() => onNavigate('agent')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700">
        Open Agent Studio <ArrowRight className="size-3.5" />
      </button>
    </article>
  );
}

function RecentConversations({ calls, onNavigate }) {
  const recent = calls.slice(0, 5);
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Latest activity</p>
          <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">Recent conversations</h3>
        </div>
        <button type="button" onClick={() => onNavigate('conversations')} className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-600">
          View all <ChevronRight className="size-3.5" />
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="grid min-h-44 place-items-center px-5 py-10 text-center">
          <div>
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><PhoneCall className="size-4" /></span>
            <p className="mt-3 text-sm font-semibold text-slate-800">No conversations yet</p>
            <p className="mt-1 text-xs text-slate-500">Run a rehearsal or share a customer experience to see outcomes here.</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {recent.map((call) => (
            <button key={call.id} type="button" onClick={() => onNavigate('conversations')} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1.2fr)_minmax(120px,.65fr)_auto] sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900">{call.result?.name || call.customerName || 'Unknown borrower'}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{call.title || call.result?.purpose || 'Loan enquiry'}</p>
              </div>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{call.result?.amount ? `₹${Number(call.result.amount).toLocaleString('en-IN')}` : duration(call.durationSecs)}</p>
              <Outcome outcome={call.result?.outcome} status={call.status} />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export default function LoanOverview({ calls, settings, options, activeLinkCount, keyConfigured, onNavigate }) {
  const qualified = calls.filter((call) => call.result?.outcome === 'qualified').length;
  const done = calls.filter((call) => call.status === 'done');
  const withDuration = calls.filter((call) => Number(call.durationSecs) > 0);
  const avgSeconds = withDuration.length
    ? withDuration.reduce((sum, call) => sum + Number(call.durationSecs), 0) / withDuration.length
    : 0;
  const complianceReviewed = calls.filter((call) => call.compliance);
  const compliancePass = complianceReviewed.filter((call) => call.compliance?.result === 'success').length;
  const qualificationRate = done.length ? Math.round((qualified / done.length) * 100) : 0;
  const complianceRate = complianceReviewed.length ? Math.round((compliancePass / complianceReviewed.length) * 100) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <Hero settings={settings} keyConfigured={keyConfigured} onNavigate={onNavigate} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={PhoneCall} label="Conversations" value={calls.length} supporting={`${done.length} analysed`} tone="blue" />
        <Metric icon={UserCheck} label="Qualification rate" value={`${qualificationRate}%`} supporting={`${qualified} qualified handoff${qualified === 1 ? '' : 's'}`} tone="teal" />
        <Metric icon={Clock3} label="Average duration" value={duration(avgSeconds)} supporting="Per completed call" tone="slate" />
        <Metric icon={ShieldCheck} label="Policy pass rate" value={complianceRate === null ? '—' : `${complianceRate}%`} supporting={`${activeLinkCount ?? 0} active share link${activeLinkCount === 1 ? '' : 's'}`} tone={complianceRate === null || complianceRate === 100 ? 'teal' : 'amber'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <Funnel calls={calls} />
        <AgentReadiness settings={settings} options={options} keyConfigured={keyConfigured} onNavigate={onNavigate} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <RecentConversations calls={calls} onNavigate={onNavigate} />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Zap className="size-[18px]" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Built into every call</p>
              <h3 className="mt-1 text-base font-semibold text-slate-950">Outcome-ready by design</h3>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[
              { icon: IndianRupee, title: 'Borrower intent', text: 'Purpose, requested amount, and urgency.' },
              { icon: FileCheck2, title: 'Structured profile', text: 'Employment, income, liabilities, and callback preference.' },
              { icon: ShieldCheck, title: 'Compliance evidence', text: 'Every analysed call carries a policy result and rationale.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
                  <Icon className="mt-0.5 size-4 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-[11px] font-medium text-teal-800">
            <CheckCircle2 className="size-4 shrink-0 text-teal-600" /> Sensitive credentials are never requested.
          </div>
        </article>
      </section>
    </div>
  );
}
