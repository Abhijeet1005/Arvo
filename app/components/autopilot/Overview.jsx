'use client';

// The check-in view: what the autopilot did, how the pipeline looks, what it
// learned this week.
import { Flame, Inbox, Mail, Megaphone, Send, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { relativeTime } from '@/lib/demos/ui';
import { STAGES } from '@/lib/autopilot/model';
import { cn } from '@/lib/utils';
import { SectionTitle, Empty } from './shared';

function Stat({ icon: Icon, label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Card className={cn(onClick && 'transition hover:border-emerald-300 dark:hover:border-emerald-500/40')}>
      <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="block w-full p-4 text-left">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          <Icon className="size-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </Tag>
    </Card>
  );
}

const EVENT_TONES = {
  win: 'bg-orange-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-emerald-500',
};

// Stages shown as the funnel, in order. Final stages that aren't progress
// (rejected, failed, closed...) are summed separately.
const FUNNEL = ['found', 'qualified', 'demo_ready', 'drafted', 'approved', 'sent', 'followup_1', 'followup_2', 'replied', 'engaged'];

export default function Overview({ view, onOpen }) {
  const f = view.funnel;
  const inPipeline = ['found', 'qualified', 'demo_ready', 'drafted', 'approved'].reduce((n, k) => n + (f[k] || 0), 0);
  const contacted = ['sent', 'followup_1', 'followup_2', 'replied', 'engaged', 'closed'].reduce((n, k) => n + (f[k] || 0), 0);
  const interested = view.prospects.filter((p) => p.reply?.label === 'interested').length;
  const max = Math.max(1, ...FUNNEL.map((k) => f[k] || 0));
  const report = view.reports[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Users} label="In pipeline" value={inPipeline} sub="being researched, built or written" onClick={() => onOpen('prospects')} />
        <Stat icon={Inbox} label="Awaiting you" value={view.queue.length} sub="drafts to approve" onClick={() => onOpen('approvals')} />
        <Stat icon={Send} label="Contacted" value={contacted} sub={`${view.today.emails || 0} of ${view.today.emailCap} emails today`} />
        <Stat icon={Mail} label="Interested" value={interested} sub="replied wanting more" />
        <Stat icon={Flame} label="Tried demo" value={f.engaged || 0} sub="called their own agent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionTitle>Pipeline</SectionTitle>
            <div className="space-y-2">
              {FUNNEL.map((id) => (
                <div key={id} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{STAGES.find((s) => s.id === id)?.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${((f[id] || 0) / max) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{f[id] || 0}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Also: {f.rejected || 0} not a fit · {f.closed || 0} closed · {f.unsubscribed || 0} unsubscribed · {f.bounced || 0} bounced · {f.failed || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <SectionTitle>Activity</SectionTitle>
            {view.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Once a mode is chosen, the autopilot starts researching within a few minutes.</p>
            ) : (
              <ol className="max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
                {view.events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex gap-2.5 text-sm">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', EVENT_TONES[e.kind] || EVENT_TONES.info)} aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words">{e.text}</span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.at}>
                      {relativeTime(e.at)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <SectionTitle aside={report && <span className="text-xs text-muted-foreground">{relativeTime(report.at)}</span>}>
            <span className="inline-flex items-center gap-2">
              <Megaphone className="size-4" /> Weekly report
            </span>
          </SectionTitle>
          {report ? (
            <div className="space-y-2 text-sm">
              <p className="whitespace-pre-line">{report.summary}</p>
              {report.addedMarket && <p className="text-muted-foreground">Started testing a new market: {report.addedMarket}.</p>}
              {report.changes?.map((c) => (
                <p key={c.id} className="text-muted-foreground">
                  A market was {c.status === 'paused' ? 'paused' : 'promoted'}: {c.why}
                </p>
              ))}
            </div>
          ) : (
            <Empty title="No report yet">The first one is written a week after emails start going out.</Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
