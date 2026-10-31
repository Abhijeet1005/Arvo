// What the operator can do from the dashboard: approve or reject drafts, edit
// them, mark a LinkedIn note sent, retry or close a prospect, manage markets.
// Every function returns { ok: true, ... } or { ok: false, error }.
// Server-only.
import { mutate, logEvent, findProspect, setStage, newId } from './store';
import { FINAL_STAGES, sanitiseMarket, sanitiseSettings, MARKET_STATUSES, stageAfter } from './model';

const now = () => new Date().toISOString();

export async function saveSettings(input) {
  const { state } = await mutate((s) => {
    const before = s.settings.mode;
    const wasHeld = s.settings.sandbox;
    s.settings = sanitiseSettings(input, s.settings);
    if (before !== s.settings.mode) logEvent(s, `Mode changed to ${s.settings.mode === 'auto' ? 'automatic' : s.settings.mode === 'approve' ? 'approve first' : 'paused'}.`);
    if (wasHeld && !s.settings.sandbox) {
      // Going live: anyone who was only ever emailed as a test gets the real email.
      const n = releaseSandboxTests(s);
      logEvent(s, `Sandbox is off: emails now go to the companies${n ? `, including ${n} that only had a test copy before` : ''}.`);
    } else if (!wasHeld && s.settings.sandbox) {
      logEvent(s, 'Sandbox is on: sending is on hold.');
    }
  });
  return { ok: true, settings: state.settings };
}

// Steps a failed prospect can be sent back to, by the step that failed.
const RETRY_STAGE = { qualifying: 'found', demo: 'qualified', writing: 'demo_ready' };

const clip = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);

export async function prospectAction(id, action, input = {}) {
  const { result } = await mutate((s) => {
    const p = findProspect(s, id);
    if (!p) return { ok: false, error: 'That prospect no longer exists.' };
    switch (action) {
      case 'approve':
        if (p.stage !== 'drafted') return { ok: false, error: 'Only drafts waiting for approval can be approved.' };
        setStage(p, 'approved', { approvedAt: now(), approvedBy: 'you' });
        logEvent(s, `You approved the outreach for ${p.name}.`, { prospectId: p.id });
        return { ok: true };
      case 'reject':
        if (FINAL_STAGES.has(p.stage)) return { ok: false, error: 'This prospect is already finished.' };
        setStage(p, 'closed', { closedReason: clip(input.reason, 200) || 'Rejected by you' });
        logEvent(s, `You rejected ${p.name}.`, { prospectId: p.id });
        return { ok: true };
      case 'edit': {
        const refused = p.stage === 'failed' && p.error?.step === 'sending';
        if (!p.draft || !(['drafted', 'approved'].includes(p.stage) || refused)) return { ok: false, error: 'This draft can no longer be changed.' };
        const d = input.draft || {};
        p.draft = {
          subject: d.subject !== undefined ? clip(d.subject, 120).replace(/\s+/g, ' ') : p.draft.subject,
          body: d.body !== undefined ? clip(d.body, 4000) : p.draft.body,
          followups: p.draft.followups.map((f, i) => ({ body: d.followups?.[i]?.body !== undefined ? clip(d.followups[i].body, 2000) : f.body })),
          linkedin: d.linkedin !== undefined ? clip(d.linkedin, 300).replace(/\s+/g, ' ') : p.draft.linkedin,
        };
        if (!p.draft.subject || !p.draft.body) return { ok: false, error: 'The subject and the email can’t be empty.' };
        p.updatedAt = now();
        p.editedAt = now();
        return { ok: true };
      }
      case 'linkedin_sent':
        p.linkedinSentAt = now();
        p.updatedAt = now();
        // Someone reachable only on LinkedIn has now been contacted.
        if (p.stage === 'approved' && !p.contact?.email) setStage(p, 'sent');
        logEvent(s, `You sent the LinkedIn note to ${p.name}.`, { prospectId: p.id });
        return { ok: true };
      case 'retry': {
        // An email refused as spam goes back to where its sequence was.
        const last = (p.emails || []).at(-1);
        const stage = p.error?.step === 'sending' ? (last ? stageAfter(last.kind) : 'approved') : RETRY_STAGE[p.error?.step];
        if (p.stage !== 'failed' || !stage) return { ok: false, error: 'Only a failed step can be retried.' };
        setStage(p, stage);
        delete p.spamRefusals;
        return { ok: true };
      }
      case 'close':
        setStage(p, 'closed', { closedReason: clip(input.reason, 200) || 'Closed by you' });
        return { ok: true };
      default:
        return { ok: false, error: 'Unknown action.' };
    }
  });
  return result;
}

export async function approveMany(ids) {
  const want = new Set((Array.isArray(ids) ? ids : []).map(String));
  const { result } = await mutate((s) => {
    let n = 0;
    for (const p of s.prospects) {
      if (p.stage !== 'drafted' || (want.size && !want.has(p.id))) continue;
      setStage(p, 'approved', { approvedAt: now(), approvedBy: 'you' });
      n++;
    }
    if (n) logEvent(s, `You approved ${n} draft${n === 1 ? '' : 's'}.`);
    return n;
  });
  return { ok: true, approved: result };
}

// Prospects that were only ever emailed in sandbox go back to "approved", so
// the real email goes out once sandbox is off.
function releaseSandboxTests(s) {
  let n = 0;
  for (const p of s.prospects) {
    if (!p.emails?.length || !p.emails.every((e) => e.sandbox)) continue;
    if (['unsubscribed', 'bounced', 'engaged', 'replied', 'closed', 'failed'].includes(p.stage)) continue;
    p.emails = [];
    setStage(p, 'approved');
    n++;
  }
  return n;
}

export async function requeueSandbox() {
  const { result } = await mutate((s) => {
    const n = releaseSandboxTests(s);
    if (n) logEvent(s, `${n} prospect${n === 1 ? '' : 's'} that only had a test copy will get the real email.`);
    return n;
  });
  return { ok: true, requeued: result };
}

// After an automatic hold (bounces, blocklist): the operator has looked and
// sending carries on. Only problems after this moment count towards the next hold.
export async function resumeSending() {
  await mutate((s) => {
    if (!s.meta.sendHold) return;
    delete s.meta.sendHold;
    s.meta.sendHoldClearedAt = new Date().toISOString();
    logEvent(s, 'You resumed sending.');
  });
  return { ok: true };
}

export async function addMarket(input) {
  try {
    const market = { id: newId('mkt'), createdAt: now(), ...sanitiseMarket(input) };
    await mutate((s) => {
      s.markets.push(market);
      logEvent(s, `Added a market: ${market.vertical}, ${market.city}.`);
    });
    return { ok: true, market };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function setMarketStatus(id, status) {
  if (!MARKET_STATUSES.includes(status)) return { ok: false, error: 'Unknown status.' };
  const { result } = await mutate((s) => {
    const m = s.markets.find((x) => x.id === id);
    if (!m) return { ok: false, error: 'That market no longer exists.' };
    m.status = status;
    logEvent(s, `Market “${m.vertical}, ${m.city}” set to ${status}.`);
    return { ok: true };
  });
  return result;
}

export async function markPostUsed(id, used = true) {
  const { result } = await mutate((s) => {
    const post = s.posts.find((x) => x.id === id);
    if (!post) return { ok: false, error: 'That draft no longer exists.' };
    post.used = Boolean(used);
    return { ok: true };
  });
  return result;
}
