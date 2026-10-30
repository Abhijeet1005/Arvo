// Telling the operator: by email to settings.alertEmail (sent from the
// outreach mailbox), and on the Slack/Discord webhook when that is set too.
//   alert()        at once: a prospect replied with interest, or is trying their demo
//   problem()      something broke; once per distinct problem
//   dailySummary() once a day in the evening, India time, when anything happened
//   weeklyReport() when the weekly review is written
// Nothing here throws: a notification that fails must not stop the autopilot.
// Server-only.
import { readState, mutate, usageToday } from './store';
import { istParts, summaryLines } from './model';
import { sendNotice, outreachMailEnabled } from './channels/email';
import { sendAlert } from '@/lib/demos/notify';

// The daily summary goes out after this hour, India time.
export const SUMMARY_HOUR = 19;

const DAY = 86_400_000;

async function deliver(subject, text, settings) {
  const s = settings || (await readState()).settings;
  const sent = [];
  if (s.alertEmail && outreachMailEnabled()) {
    const r = await sendNotice({ to: s.alertEmail, subject, text });
    if (r.ok) sent.push('email');
  }
  if (await sendAlert(`${subject}\n${text}`)) sent.push('webhook');
  return sent;
}

const link = (settings, path = '/autopilot') => (settings.publicUrl ? `${settings.publicUrl}${path}` : '');

export async function alert(subject, lines) {
  try {
    const { settings } = await readState();
    const open = link(settings);
    await deliver(subject, [...lines, '', open ? `Open the Autopilot: ${open}` : ''].join('\n').trim(), settings);
  } catch (e) {
    console.error('[autopilot] alert failed:', e?.message || e);
  }
}

// The same problem is reported again only after a day, or when it changes.
export async function problem(key, message) {
  try {
    let fresh = false;
    await mutate((s) => {
      const seen = (s.meta.problemsAlerted ||= {});
      const last = seen[key];
      if (last && last.message === message && Date.now() - Date.parse(last.at) < DAY) return;
      seen[key] = { message, at: new Date().toISOString() };
      fresh = true;
    });
    if (fresh) await alert(`⚠️ Autopilot problem: ${key}`, [message, '', 'The autopilot keeps retrying; nothing else is needed if it was temporary.']);
  } catch (e) {
    console.error('[autopilot] problem alert failed:', e?.message || e);
  }
}

// Called on every tick; sends at most one summary per India day.
export async function dailySummary(now = new Date()) {
  try {
    const state = await readState();
    const { day, hour } = istParts(now);
    if (hour < SUMMARY_HOUR || state.meta.summaryDay === day || !state.settings.alertEmail) return false;
    const since = state.meta.summaryAt ? Date.parse(state.meta.summaryAt) : now.getTime() - DAY;
    const lines = summaryLines(state, since, usageToday(state));
    await mutate((s) => {
      s.meta.summaryDay = day;
      if (lines) s.meta.summaryAt = now.toISOString();
    });
    if (!lines) return false;
    const waiting = state.prospects.filter((p) => p.stage === 'drafted').length;
    const subject = waiting ? `Autopilot: ${waiting} draft${waiting === 1 ? '' : 's'} waiting for you` : 'Autopilot: today’s summary';
    await deliver(subject, [...lines, '', link(state.settings) ? `Open the Autopilot: ${link(state.settings)}` : ''].join('\n').trim(), state.settings);
    return true;
  } catch (e) {
    console.error('[autopilot] daily summary failed:', e?.message || e);
    return false;
  }
}

export async function weeklyReport(report, posts) {
  const lines = [report.summary];
  if (report.addedMarket) lines.push('', `Now testing a new market: ${report.addedMarket}.`);
  for (const c of report.changes || []) lines.push(`A market was ${c.status === 'paused' ? 'paused' : 'promoted'}: ${c.why}`);
  if (posts.length) {
    lines.push('', 'LinkedIn post drafts for your profile:');
    posts.forEach((t, i) => lines.push('', `— Post ${i + 1} —`, t));
  }
  await alert('📈 Autopilot weekly report', lines);
}

// A one-off test from Settings. Returns where it was delivered.
export async function testNotification() {
  const state = await readState();
  const sent = await deliver(
    '✅ Autopilot notifications are working',
    [
      'This is a test. From now on you get an email here when:',
      '  • a prospect replies with interest, or tries their demo (at once)',
      '  • something breaks (once per problem)',
      `  • there is something to report that day (around ${SUMMARY_HOUR}:00 India time)`,
      '  • the weekly report is ready',
      '',
      link(state.settings) ? `Open the Autopilot: ${link(state.settings)}` : '',
    ]
      .join('\n')
      .trim(),
    state.settings
  );
  return sent;
}
