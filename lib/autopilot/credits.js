// Watching the voice (ElevenLabs) account's credits, which every demo call and
// loan call spends. Checked about once an hour; the operator gets an email
// when they run low, again only if it gets worse, and once more if they run
// out, so demos never quietly stop answering.
// Server-only.
import { elevenlabs, friendlyError } from '@/lib/loan/elevenlabs';
import { keyStatus } from '@/lib/loan/settings';
import { creditStatus, creditAlertDue } from './model';
import { readState, mutate, logEvent } from './store';
import { alert } from './alerts';

const CHECK_EVERY_MS = 55 * 60_000;
const KEEP_SAMPLES = 40;

const fmt = (n) => Math.round(n).toLocaleString('en-IN');
const day = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

// Reads the balance if it's time (or `force`), records it, and alerts when it
// got worse. Returns the status, or null when there's no key or no check due.
export async function checkCredits({ force = false } = {}) {
  const state = await readState();
  const c = state.meta.credits || {};
  if (!force && c.checkedAt && Date.now() - Date.parse(c.checkedAt) < CHECK_EVERY_MS) return null;
  if (!(await keyStatus()).configured) return null;

  let sub;
  try {
    sub = await elevenlabs('/v1/user/subscription', { timeoutMs: 15000 });
  } catch (e) {
    // Can't read it this time; the next check tries again.
    console.error('[autopilot] credit check failed:', friendlyError(e));
    return null;
  }
  const now = Date.now();
  const reading = {
    used: Number(sub.character_count) || 0,
    limit: Number(sub.character_limit) || 0,
    resetAt: sub.next_character_count_reset_unix ? sub.next_character_count_reset_unix * 1000 : null,
  };
  // A new billing period starts the history (and the alerts) afresh.
  const period = String(reading.resetAt || 'none');
  const samples = c.period === period ? c.samples || [] : [];
  const status = creditStatus(reading, samples, now);
  const alerted = c.period === period ? c.alerted || 'ok' : 'ok';
  const due = creditAlertDue(status.level, alerted);

  await mutate((s) => {
    s.meta.credits = {
      period,
      checkedAt: new Date(now).toISOString(),
      tier: String(sub.tier || ''),
      overage: Boolean(sub.can_extend_character_limit),
      status,
      samples: [...samples, { at: now, used: reading.used }].slice(-KEEP_SAMPLES),
      alerted: due ? status.level : alerted,
    };
    if (due) logEvent(s, `Voice credits ${status.level === 'empty' ? 'ran out' : `are ${status.level}`}: ${fmt(status.remaining)} of ${fmt(status.limit)} left.`, { kind: 'warning' });
  });

  if (due) await alert(subjectFor(status), linesFor(status, sub));
  return status;
}

function subjectFor(st) {
  if (st.level === 'empty') return '🛑 ElevenLabs credits have run out: demos have stopped answering';
  const pct = Math.round(st.pctLeft * 100);
  return st.level === 'critical' ? `🛑 ElevenLabs credits almost gone: ${pct}% left` : `⚠️ ElevenLabs credits running low: ${pct}% left`;
}

function linesFor(st, sub) {
  const lines = [`Used ${fmt(st.used)} of ${fmt(st.limit)} credits this period (${fmt(st.remaining)} left).`];
  if (st.resetAt) lines.push(`They reset on ${day(st.resetAt)}.`);
  if (st.emptyAt && st.level !== 'empty') {
    lines.push(
      st.resetAt && st.emptyAt >= st.resetAt
        ? 'At the current pace they last until the reset.'
        : `At the current pace they run out around ${day(st.emptyAt)}${st.resetAt ? ', before the reset' : ''}.`
    );
  }
  lines.push(
    '',
    'Every call on a demo or loan link uses these credits; when they run out, prospects trying their demo get no answer.',
    sub.can_extend_character_limit
      ? 'Usage-based billing is available on your plan, so calls may continue as paid overage; check the limit you set.'
      : 'To keep demos working: upgrade or top up at https://elevenlabs.io/app/subscription (or enable usage-based billing).'
  );
  return lines;
}
