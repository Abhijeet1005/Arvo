// Alerts when someone uses a demo link.
//
// One webhook, ARVO_NOTIFY_WEBHOOK, that takes a JSON body with `text` (Slack)
// and `content` (Discord), so either works. Unset means no alerts. Nothing here
// ever throws: an alert that fails must not affect a call.
import { publicResult } from './model';
import { mailEnabled, sendMail } from './mail';
import { isLeadOutcome, leadText } from './ui';

const LABELS = {
  lead_captured: 'lead captured',
  callback_requested: 'callback requested',
  info_only: 'information only',
  wrong_number: 'wrong number',
  spam: 'spam',
  qualified: 'qualified',
  callback: 'callback',
  not_interested: 'not interested',
  dnc: 'do not call',
};

const label = (v) => LABELS[v] || String(v || '').replace(/_/g, ' ');
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

// HTTPS only, except a listener on this machine (handy for trying it out).
function webhookUrl() {
  const url = String(process.env.ARVO_NOTIFY_WEBHOOK || '').trim();
  return /^https:\/\/\S+$/i.test(url) || /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/\S*)?$/i.test(url) ? url : '';
}

export const notificationsEnabled = () => Boolean(webhookUrl());

async function send(text) {
  const url = webhookUrl();
  if (!url) return false;
  const message = clip(text, 1800);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch (e) {
    console.error('[demos] alert failed:', e?.name === 'TimeoutError' ? 'timed out' : e?.message || e);
    return false;
  }
}

// A plain alert on the same webhook (the autopilot's hot leads). Returns
// whether it was delivered.
export const sendAlert = (text) => send(text);

function resultLines(call) {
  const r = call.result;
  const lines = [];
  if (!r) return lines;
  if (r.kind === 'assistant') {
    lines.push(`Outcome: ${label(r.outcome)}${r.urgency && r.urgency !== 'normal' ? ` (${r.urgency})` : ''}`);
    const who = [r.callerName, r.callerPhone].filter(Boolean).join(' · ');
    if (who) lines.push(`Caller: ${who}`);
    for (const f of r.fields || []) {
      if (['caller_name', 'caller_phone', 'urgency', 'unanswered_questions'].includes(f.key)) continue;
      if (lines.length >= 9) break;
      lines.push(`${f.label}: ${clip(f.value, 160)}`);
    }
    if (r.notes) lines.push(`Notes: ${clip(r.notes, 300)}`);
    return lines;
  }
  // loan qualifier
  lines.push(`Outcome: ${label(r.outcome)}`);
  const who = [r.name, r.phone].filter(Boolean).join(' · ');
  if (who) lines.push(`Customer: ${who}`);
  if (r.purpose) lines.push(`Purpose: ${r.purpose}${r.amount ? `, ₹${Number(r.amount).toLocaleString('en-IN')}` : ''}`);
  if (r.notes) lines.push(`Notes: ${clip(r.notes, 300)}`);
  return lines;
}

// ------------------------------------------------ the client's own leads

const subjectFor = (businessName, card) => {
  const who = card.callerName || card.callerPhone || 'a caller';
  return `New enquiry from ${who} (${businessName})`;
};

// Email a finished call to the client's addresses when it holds a lead.
// Returns 'sent', 'skipped' (nothing to send) or 'failed'.
export async function deliverLead({ demo, call }) {
  const to = demo?.delivery?.emails || [];
  if (to.length === 0 || !mailEnabled()) return 'skipped';
  const card = publicResult(call);
  if (!card || !isLeadOutcome(card.outcome)) return 'skipped';
  const message = { to, subject: subjectFor(demo.business.name, card), text: leadText(demo.business.name, card) };
  let sent = await sendMail(message);
  if (!sent.ok) {
    // A lead is the one thing worth a second try.
    await new Promise((r) => setTimeout(r, 4000));
    sent = await sendMail(message);
  }
  return sent.ok ? 'sent' : 'failed';
}

// A made-up lead, so the operator can check that the client's inbox gets it.
export async function sendTestLead(demo) {
  const to = demo?.delivery?.emails || [];
  if (to.length === 0) return { ok: false, error: 'Add an email address first and save.' };
  const card = {
    outcome: 'lead_captured',
    urgency: '',
    callerName: 'Test Caller',
    callerPhone: '+910000000000',
    fields: [{ key: 'looking_for', label: 'Looking for', value: 'Example enquiry' }],
    notes: 'This is a test message. Real enquiries look like this.',
    summary: '',
  };
  return sendMail({ to, subject: `Test: ${subjectFor(demo.business.name, card)}`, text: leadText(demo.business.name, card) });
}

export async function notifyStarted({ demo, linkLabel }) {
  if (!notificationsEnabled() || !demo) return false;
  return send(`Demo call started: ${demo.business.name}${linkLabel ? ` (link: ${linkLabel})` : ''}. Someone just opened the call room and is talking to ${demo.agent.name}.`);
}

export async function notifyFinished({ demo, call }) {
  if (!notificationsEnabled() || !call) return false;
  const name = demo?.business?.name || call.businessName || 'A demo';
  const secs = Number(call.durationSecs) || 0;
  const head = `Demo call finished: ${name}${call.linkLabel ? ` (link: ${call.linkLabel})` : ''}${secs ? `, ${secs} sec` : ''}.`;
  const lines = resultLines(call);
  if (!lines.length && call.summary) lines.push(clip(call.summary, 400));
  if (!lines.length) lines.push('No details were captured.');
  return send([head, ...lines].join('\n'));
}
