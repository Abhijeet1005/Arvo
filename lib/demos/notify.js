// Alerts when someone uses a demo link.
//
// One webhook, ARVO_NOTIFY_WEBHOOK, that takes a JSON body with `text` (Slack)
// and `content` (Discord), so either works. Unset means no alerts. Nothing here
// ever throws: an alert that fails must not affect a call.
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
