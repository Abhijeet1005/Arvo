'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { Bot, Languages, Cpu, Radio, FileText, Settings2, Plug, PhoneCall, CheckCircle2 } from 'lucide-react';

const LANG = { hi: 'Hindi + Hinglish', en: 'English' };
const LLM = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gpt-4o-mini': 'GPT-4o mini',
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
};

const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
};

function StatCard({ icon: Icon, label, value, sub, tone = 'indigo' }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={`grid size-8 place-items-center rounded-lg ${TONES[tone]}`}>
            <Icon className="size-4" />
          </span>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StepLink({ href, icon: Icon, n, title, desc, done }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Icon className="size-4" />
        </span>
        {done ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">Step {n}</span>
        )}
      </div>
      <div className="text-sm font-semibold group-hover:text-indigo-700">{title}</div>
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
  const dash = loaded ? '—' : '…';

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Your support agent at a glance — set it up, add knowledge, and test a call.">
        <Badge variant={live ? 'success' : 'secondary'}>{loaded ? (live ? 'Agent live' : 'Not set up') : 'Loading…'}</Badge>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Bot} label="Agent" tone="indigo" value={loaded ? (live ? 'Live' : 'Not set up') : dash} sub={live ? `ID ${String(data.agentId).slice(0, 14)}…` : 'Create it in Agent'} />
        <StatCard icon={Languages} label="Language" tone="violet" value={LANG[cfg.language] || dash} sub="voice + understanding" />
        <StatCard icon={Cpu} label="Model" tone="emerald" value={LLM[cfg.llm] || dash} sub="reasoning engine" />
        <StatCard icon={Radio} label="Channels" tone="amber" value="Web" sub="Phone: not connected" />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Set up checklist</h2>
            {live && <Badge variant="success">Agent created</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Four steps to a working voice agent.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StepLink href="/agent" icon={Settings2} n={1} title="Configure agent" desc="Name, voice, language & behaviour" done={live} />
            <StepLink href="/knowledge" icon={FileText} n={2} title="Add knowledge" desc="Upload docs it answers from" />
            <StepLink href="/connectors" icon={Plug} n={3} title="Connect data" desc="Live orders, tickets & more" />
            <StepLink href="/test" icon={PhoneCall} n={4} title="Test a call" desc="Talk to it in your browser" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
