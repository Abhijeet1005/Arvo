// What the Autopilot dashboard shows, in one round trip.
// Server-only.
import { readState, usageToday, mutate, serverPublicUrl } from './store';
import { STAGES, marketStats, winRate, sendingGaps, emailCapToday, istDay, istParts, cleanPublicUrl } from './model';
import { claudeConfigured, MODEL } from './claude';
import { outreachMailEnabled, senderAddress } from './channels/email';
import { inboxEnabled } from './inbox';
import { schedulerStatus } from './scheduler';
import { keyStatus } from '@/lib/loan/settings';
import { notificationsEnabled } from '@/lib/demos/notify';

const MAX_LISTED = 400;

// The dashboard's own public address, from the request that opened it. Caddy
// passes the original host and scheme along.
export function originOf(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https');
  return cleanPublicUrl(`${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`);
}

// Remember where links should point the first time the dashboard is opened.
export async function rememberPublicUrl(req) {
  const state = await readState();
  if (state.settings.publicUrl) return;
  const url = originOf(req);
  if (url) await mutate((s) => void (s.settings.publicUrl ||= url));
}

// A prospect as listed in the table (no drafts, no website text).
function row(p) {
  return {
    id: p.id,
    name: p.name,
    website: p.website,
    city: p.city,
    marketId: p.marketId,
    stage: p.stage,
    fit: p.fit ? { score: p.fit.score, reason: p.fit.reason } : null,
    email: p.contact?.email || '',
    linkedin: p.linkedin || '',
    demoUrl: p.demoUrl || '',
    emails: (p.emails || []).map((e) => ({ kind: e.kind, at: e.at, sandbox: Boolean(e.sandbox) })),
    reply: p.reply || null,
    engagedAt: p.engagedAt || null,
    demoCalls: p.demoCalls || 0,
    error: p.error || null,
    closedReason: p.closedReason || '',
    updatedAt: p.updatedAt,
  };
}

// A prospect waiting for approval, with everything needed to judge it.
function queued(p) {
  return { ...row(p), why: p.why || '', hook: p.fit?.hook || '', draft: p.draft, contact: p.contact || {} };
}

export async function autopilotView() {
  const [state, key] = await Promise.all([readState(), keyStatus()]);
  const { settings } = state;
  const today = usageToday(state);
  const stats = marketStats(state.prospects);
  const funnel = Object.fromEntries(STAGES.map((s) => [s.id, 0]));
  for (const p of state.prospects) funnel[p.stage] = (funnel[p.stage] || 0) + 1;

  const smtp = outreachMailEnabled();
  const days = Object.entries(state.usage.days)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 14)
    .map(([day, u]) => ({ day, ...u }));
  const sandboxSent = state.prospects.filter((p) => p.emails?.length && p.emails.every((e) => e.sandbox) && !['unsubscribed', 'bounced'].includes(p.stage)).length;

  return {
    settings,
    model: MODEL,
    now: { day: istDay(), hour: istParts().hour },
    config: {
      claude: claudeConfigured(),
      elevenlabs: key.configured,
      smtp,
      sender: senderAddress(),
      imap: inboxEnabled(),
      alerts: notificationsEnabled(),
      publicUrlFromServer: Boolean(serverPublicUrl()),
    },
    gaps: sendingGaps(settings, { smtp }),
    scheduler: schedulerStatus(),
    today: {
      ...today,
      usd: today.usd || 0,
      emailCap: emailCapToday(settings, state.usage.firstSendDay, istDay()),
      firstSendDay: state.usage.firstSendDay,
    },
    days,
    funnel,
    markets: state.markets.map((m) => ({ ...m, stats: stats[m.id] || {}, winRate: winRate(stats[m.id]) })),
    queue: state.prospects.filter((p) => p.stage === 'drafted').map(queued),
    linkedin: state.prospects
      .filter((p) => p.linkedin && p.draft?.linkedin && !p.linkedinSentAt && ['approved', 'sent', 'followup_1', 'followup_2'].includes(p.stage))
      .map((p) => ({ ...row(p), note: p.draft.linkedin })),
    prospects: state.prospects.slice(0, MAX_LISTED).map(row),
    totalProspects: state.prospects.length,
    sandboxSent,
    suppressed: state.suppression.emails.length + state.suppression.domains.length,
    events: state.events.slice(0, 60),
    reports: state.reports.slice(0, 4),
    posts: state.posts.slice(0, 9),
  };
}
