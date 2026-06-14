'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/page-header';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bot, Languages, Cpu, Radio, FileText, Settings2, Plug, PhoneCall,
  CheckCircle2, ArrowRight, Sparkles,
} from 'lucide-react';

const LANG = { hi: 'Hindi + Hinglish', en: 'English' };
const LLM = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gpt-4o-mini': 'GPT-4o mini',
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
};

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  stone: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300',
};

function StatCard({ icon: Icon, label, value, sub, tone = 'emerald', delay = 0, loading }) {
  return (
    <Card
      className="group animate-fade-up transition-[transform,box-shadow] duration-200 ease-out-strong hover:-translate-y-0.5 hover:shadow-card-hover"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={cn('grid size-9 place-items-center rounded-lg transition-transform duration-200 ease-out-strong group-hover:scale-110', TONES[tone])}>
            <Icon className="size-[18px]" />
          </span>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-7 w-24" />
        ) : (
          <div className="mt-3 text-[26px] font-bold leading-none tracking-tight">{value}</div>
        )}
        {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StepLink({ href, icon: Icon, n, title, desc, done, delay = 0 }) {
  return (
    <Link
      href={href}
      style={{ animationDelay: `${delay}ms` }}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 animate-fade-up transition-[transform,box-shadow,border-color] duration-200 ease-out-strong hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-card-hover active:scale-[0.98] dark:hover:border-emerald-500/40"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'grid size-9 place-items-center rounded-lg transition-colors duration-200',
            done
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400 dark:group-hover:text-white'
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        {done ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">Step {n}</span>
        )}
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
        {title}
        <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 ease-out-strong group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/agent')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const live = !!data?.agentId;
  const cfg = data?.config || {};
  const loading = !loaded;

  const steps = [
    { href: '/agent', icon: Settings2, title: 'Configure agent', desc: 'Name, voice, language & behaviour', done: live },
    { href: '/knowledge', icon: FileText, title: 'Add knowledge', desc: 'Upload docs it answers from', done: false },
    { href: '/connectors', icon: Plug, title: 'Connect data', desc: 'Live orders, tickets & more', done: false },
    { href: '/test', icon: PhoneCall, title: 'Test a call', desc: 'Talk to it in your browser', done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Your support agent at a glance — set it up, add knowledge, and test a call.">
        <Badge variant={live ? 'success' : 'secondary'}>{loaded ? (live ? 'Agent live' : 'Not set up') : 'Loading…'}</Badge>
      </PageHeader>

      {/* Hero status banner */}
      <Card className="animate-fade-up border-emerald-100 bg-emerald-50/40 shadow-card dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <Sparkles className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight">
                {loading ? 'Loading your agent…' : live ? 'Your agent is live' : 'Finish setup to go live'}
              </h2>
              {loading ? (
                <Skeleton className="mt-2 h-4 w-56" />
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {live
                    ? `Answering in ${LANG[cfg.language] || '—'} · ${LLM[cfg.llm] || '—'}`
                    : 'Create your agent, add knowledge, then test a call.'}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/test" className={cn(buttonVariants(), 'gap-1.5')}>
              <PhoneCall className="size-4" /> Test a call
            </Link>
            <Link href="/agent" className={buttonVariants({ variant: 'outline' })}>Configure</Link>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Bot} label="Agent" tone="emerald" value={live ? 'Live' : 'Not set up'} sub={live ? `ID ${String(data.agentId).slice(0, 14)}…` : 'Create it in Agent'} loading={loading} delay={0} />
        <StatCard icon={Languages} label="Language" tone="teal" value={LANG[cfg.language] || '—'} sub="voice + understanding" loading={loading} delay={60} />
        <StatCard icon={Cpu} label="Model" tone="amber" value={LLM[cfg.llm] || '—'} sub="reasoning engine" loading={loading} delay={120} />
        <StatCard icon={Radio} label="Channels" tone="stone" value="Web" sub="Phone: not connected" delay={180} />
      </div>

      {/* Setup checklist with progress */}
      <Card className="animate-fade-up shadow-card" style={{ animationDelay: '120ms' }}>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Set up checklist</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{doneCount} of {steps.length} steps complete</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{pct}%</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out-strong" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <StepLink key={s.href} n={i + 1} delay={i * 60} {...s} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
