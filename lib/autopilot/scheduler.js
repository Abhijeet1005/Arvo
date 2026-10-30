// The autopilot's clock. Every few minutes one tick moves the pipeline along,
// a few prospects at a time, each step within its daily cap:
//
//   inbox -> approve (automatic mode) -> send one due email -> write drafts
//   -> build demos -> qualify -> research (when the pipeline runs low)
//   -> weekly review
//
// Sending comes before the steps that use Claude, so a spent Claude budget
// never holds up email that is already approved. Network work happens outside
// the store lock: each step reads, works, then writes its result back.
// Server-only.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  FINAL_STAGES,
  MAX_ATTEMPTS,
  SEQUENCE_STAGES,
  chooseMarket,
  freshCandidates,
  inSendWindow,
  marketBlock,
  marketTz,
  istDay,
  marketStats,
  nameKey,
  domainOf,
  nextEmail,
  remaining,
  sendingGaps,
  sequenceKinds,
  stageAfter,
} from './model';
import { readState, mutate, logEvent, addUsage, usageToday, findProspect, setStage, compactRejected, isSuppressed, knownCompanies, newId, newToken, suppress } from './store';
import { claudeConfigured, BudgetError } from './claude';
import { researchMarket } from './research';
import { qualify } from './qualify';
import { findEmail } from './finder';
import { buildDemo } from './demo';
import { writeOutreach } from './writer';
import { outreachMailEnabled, sendOutreach } from './channels/email';
import { inboxEnabled, checkInbox } from './inbox';
import { reviewDue, weeklyReview } from './learn';
import { problem, dailySummary } from './alerts';
import { checkCredits } from './credits';
import { SiteError } from '@/lib/demos/fetchSite';
import { keyStatus } from '@/lib/loan/settings';
import { parseCsv } from '@/lib/demos/csv';

const TICK_MS = 5 * 60_000;
const FIRST_TICK_MS = 30_000;
const PER_TICK = { qualify: 3, demos: 2, drafts: 3 };
// Space emails out like a person would (one per tick at most, plus a pause).
const SEND_GAP_MS = [3 * 60_000, 8 * 60_000];
// After the mail server refuses an email as spam, nothing is sent for this
// long; an email refused this many times is set aside. Any other send failure
// waits FAIL_PAUSE_MS before the next try.
const SPAM_PAUSE_MS = 2 * 3_600_000;
const MAX_SPAM_REFUSALS = 2;
const FAIL_PAUSE_MS = 30 * 60_000;
// A finished sequence with no answer is closed this long after the last email.
const CLOSE_AFTER_MS = 7 * 86_400_000;

const g = globalThis;
const clock = () => (g.__arvoAutopilot ||= { timer: null, running: false, lastTickAt: null, lastResult: '' });

// Start the clock once per server process (called from instrumentation.js and
// from the autopilot's API routes).
export function startAutopilot() {
  const c = clock();
  if (c.timer) return;
  c.timer = setInterval(() => runTick().catch(() => {}), TICK_MS);
  c.timer.unref?.();
  setTimeout(() => runTick().catch(() => {}), FIRST_TICK_MS).unref?.();
}

export function schedulerStatus() {
  const c = clock();
  return { running: c.running, lastTickAt: c.lastTickAt, lastResult: c.lastResult, everyMinutes: TICK_MS / 60_000 };
}

// One tick. Never overlaps another; returns { ok, busy?, done[] }.
export async function runTick() {
  const c = clock();
  if (c.running) return { ok: false, busy: true, done: [] };
  c.running = true;
  const done = [];
  try {
    await tick(done);
    c.lastResult = done.length ? done.join(' · ') : 'Nothing to do.';
    return { ok: true, done };
  } catch (e) {
    console.error('[autopilot] tick failed:', e);
    c.lastResult = 'The last run failed (see the server log).';
    return { ok: false, done, error: c.lastResult };
  } finally {
    c.running = false;
    c.lastTickAt = new Date().toISOString();
  }
}

async function tick(done) {
  // Voice credits are watched even while paused: demo links stay live.
  await step('credit check', done, () => checkCredits());
  const { settings } = await readState();
  if (settings.mode === 'paused') return;

  await step('inbox', done, async () => {
    if (!inboxEnabled()) return;
    const n = await checkInbox();
    if (n) done.push(`${n} repl${n === 1 ? 'y' : 'ies'} read`);
  });

  if (settings.mode === 'auto') {
    const { result: n } = await mutate((s) => {
      let count = 0;
      for (const p of s.prospects) {
        if (p.stage !== 'drafted') continue;
        setStage(p, 'approved', { approvedAt: new Date().toISOString(), approvedBy: 'auto' });
        count++;
      }
      if (count) logEvent(s, `Approved ${count} draft${count === 1 ? '' : 's'} automatically.`);
      return count;
    });
    if (n) done.push(`${n} approved`);
  }

  await step('send', done, () => sendDue(done));

  // Once a day, in the evening: what happened and what waits for approval.
  if (await dailySummary()) done.push('daily summary');

  if (!claudeConfigured()) return;
  try {
    await step('writing', done, () => writeDrafts(done), { rethrowBudget: true });
    await step('demos', done, () => buildDemos(done));
    await step('finding emails', done, () => findMissingEmails(done), { rethrowBudget: true });
    await step('qualifying', done, () => qualifySome(done), { rethrowBudget: true });
    await step('research', done, () => researchIfLow(done), { rethrowBudget: true });
    await step('weekly review', done, async () => {
      const state = await readState();
      if (!reviewDue(state)) return;
      await weeklyReview(state);
      done.push('weekly review');
    }, { rethrowBudget: true });
  } catch (e) {
    if (!(e instanceof BudgetError)) throw e;
    // Once a day is enough to say so.
    await mutate((s) => {
      if (s.meta.budgetNoticeDay === istDay()) return;
      s.meta.budgetNoticeDay = istDay();
      logEvent(s, e.message, { kind: 'warning' });
    });
    done.push('spend cap reached');
  }
}

// Run one step; a failure is logged (once per distinct message) and the tick
// carries on with the next step.
async function step(name, done, fn, { rethrowBudget = false } = {}) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof BudgetError && rethrowBudget) throw e;
    if (e instanceof BudgetError) return;
    console.error(`[autopilot] ${name} failed:`, e);
    const message = String(e?.message || e).slice(0, 200);
    let fresh = false;
    await mutate((s) => {
      const errors = (s.meta.errors ||= {});
      if (errors[name]?.message === message) return;
      errors[name] = { message, at: new Date().toISOString() };
      logEvent(s, `${name[0].toUpperCase()}${name.slice(1)} failed: ${message}`, { kind: 'error' });
      fresh = true;
    }).catch(() => {});
    if (fresh) await problem(name, message);
  }
}

// A prospect's step failed: count it, and give up after a few tries.
async function failed(id, stepName, e) {
  const message = String(e?.message || e).slice(0, 300);
  await mutate((s) => {
    const p = findProspect(s, id);
    if (!p) return;
    p.attempts = (p.attempts || 0) + 1;
    p.error = { step: stepName, message, at: new Date().toISOString() };
    if (p.attempts >= MAX_ATTEMPTS) {
      p.stage = 'failed';
      logEvent(s, `Gave up on ${p.name} (${stepName}): ${message}`, { kind: 'error', prospectId: p.id });
    }
  });
}

const marketOf = (state, p) => state.markets.find((m) => m.id === p.marketId) || { vertical: 'Business', city: p.city || '', country: 'IN', industry: 'generic', brief: '' };
const oldestFirst = (a, b) => Date.parse(a.updatedAt || a.createdAt) - Date.parse(b.updatedAt || b.createdAt);

// ------------------------------------------------------------ send

async function sendDue(done) {
  let state = await readState();
  const { settings } = state;
  const now = Date.now();

  // Sequences that ended without an answer are closed.
  await mutate((s) => {
    const kinds = sequenceKinds(s.settings);
    for (const p of s.prospects) {
      if (!SEQUENCE_STAGES.includes(p.stage)) continue;
      const sent = p.emails || [];
      if (sent.length < kinds.length) continue;
      if (now - Date.parse(sent[sent.length - 1].at) >= CLOSE_AFTER_MS) setStage(p, 'closed', { closedReason: 'No reply' });
    }
  });

  // On hold: approved emails wait until sandbox is turned off.
  if (settings.sandbox) return;
  if (sendingGaps(settings, { smtp: outreachMailEnabled() }).length) return;
  if (state.meta.nextSendAt && now < Date.parse(state.meta.nextSendAt)) return;
  if (remaining(settings, usageToday(state), 'emails', { firstSendDay: state.usage.firstSendDay }) <= 0) return;

  // Follow-ups first (oldest first), then new first emails in approval order.
  const due = state.prospects
    .map((p) => ({ p, next: nextEmail(p, settings, now) }))
    .filter((x) => x.next)
    // Business hours where the recipient is, and a country that can be emailed.
    .filter((x) => {
      const m = marketOf(state, x.p);
      return !marketBlock(m, settings) && inSendWindow(settings.window, new Date(now), marketTz(m));
    })
    .sort((a, b) => (a.next.kind === 'first') - (b.next.kind === 'first') || oldestFirst(a.p, b.p));
  for (const { p, next } of due) {
    if (isSuppressed(state, p.contact.email)) {
      await mutate((s) => {
        const q = findProspect(s, p.id);
        if (q) setStage(q, 'closed', { closedReason: 'Address is on the do-not-contact list' });
      });
      continue;
    }
    const res = await sendOutreach(p, next.kind, settings);
    if (res.ok) {
      await mutate((s) => {
        const q = findProspect(s, p.id);
        if (!q) return;
        const at = new Date().toISOString();
        q.emails = [...(q.emails || []), { kind: next.kind, to: res.to, at, messageId: res.messageId }];
        if (!FINAL_STAGES.has(q.stage)) setStage(q, stageAfter(next.kind));
        addUsage(s, { emails: 1 });
        if (!s.usage.firstSendDay) s.usage.firstSendDay = istDay();
        const [lo, hi] = SEND_GAP_MS;
        s.meta.nextSendAt = new Date(Date.now() + lo + Math.random() * (hi - lo)).toISOString();
        logEvent(s, `${next.kind === 'first' ? 'Emailed' : 'Followed up with'} ${q.name}.`, { prospectId: q.id });
      });
      done.push(`emailed ${p.name}`);
    } else if (res.rejected) {
      await mutate((s) => {
        const q = findProspect(s, p.id);
        if (!q) return;
        suppress(s, q.contact.email);
        setStage(q, 'bounced');
        logEvent(s, `The address for ${q.name} was refused; it won't be used again.`, { kind: 'warning', prospectId: q.id });
      });
    } else if (res.spam) {
      // The mail server judged this email's content as spam. Sending it again
      // unchanged only hurts the mailbox, so all sending waits a while, and
      // after a second refusal this email is set aside for the operator.
      let message = '';
      await mutate((s) => {
        s.meta.nextSendAt = new Date(Date.now() + SPAM_PAUSE_MS).toISOString();
        const q = findProspect(s, p.id);
        if (!q) return;
        q.spamRefusals = (q.spamRefusals || 0) + 1;
        q.error = { step: 'sending', message: res.error, at: new Date().toISOString() };
        const final = q.spamRefusals >= MAX_SPAM_REFUSALS;
        if (final) q.stage = 'failed';
        message = `The mail server refused the email to ${q.name} as spam${final ? ' twice; it is set aside (edit and retry it from Prospects)' : ''}. Sending is paused for ${SPAM_PAUSE_MS / 3_600_000} hours.`;
        logEvent(s, message, { kind: 'error', prospectId: q.id });
      });
      await problem('sending', message);
    } else {
      // A mailbox problem affects every send: wait a while, then try again.
      await mutate((s) => {
        s.meta.nextSendAt = new Date(Date.now() + FAIL_PAUSE_MS).toISOString();
      });
      throw new Error(res.error);
    }
    return; // one email per tick
  }
}

// ------------------------------------------------------------ write

async function writeDrafts(done) {
  const state = await readState();
  const batch = state.prospects.filter((p) => p.stage === 'demo_ready').sort(oldestFirst).slice(0, PER_TICK.drafts);
  for (const p of batch) {
    try {
      const { draft } = await writeOutreach(p, marketOf(state, p), state.settings);
      await mutate((s) => {
        const q = findProspect(s, p.id);
        if (!q || q.stage !== 'demo_ready') return;
        setStage(q, 'drafted', { draft, unsubToken: q.unsubToken || newToken() });
        addUsage(s, { drafts: 1 });
        logEvent(s, `Drafted outreach for ${q.name}${s.settings.mode === 'approve' ? '; it is waiting for your approval' : ''}.`, { prospectId: q.id });
      });
      done.push(`drafted ${p.name}`);
    } catch (e) {
      if (e instanceof BudgetError) throw e;
      await failed(p.id, 'writing', e);
    }
  }
}

// ------------------------------------------------------------ demos

async function buildDemos(done) {
  const state = await readState();
  const left = Math.min(PER_TICK.demos, remaining(state.settings, usageToday(state), 'demos'));
  if (!left || !state.settings.publicUrl) return;
  if (!(await keyStatus()).configured) return;
  const batch = state.prospects.filter((p) => p.stage === 'qualified').sort(oldestFirst).slice(0, left);
  for (const p of batch) {
    try {
      const demo = await buildDemo(p, marketOf(state, p), state.settings.publicUrl);
      await mutate((s) => {
        const q = findProspect(s, p.id);
        if (!q) return;
        delete q.profile; // the demo holds it now
        setStage(q, 'demo_ready', demo);
        addUsage(s, { demos: 1 });
        logEvent(s, `Built a demo for ${q.name}.`, { prospectId: q.id });
      });
      done.push(`demo for ${p.name}`);
    } catch (e) {
      await failed(p.id, 'demo', e);
    }
  }
}

// ------------------------------------------------------------ finding emails

const NO_CONTACT = 'No public email address or LinkedIn page found.';
const OLD_NO_CONTACT = 'No public email address or LinkedIn page on their website.';
const PER_TICK_FIND = 2;

// The finder, for use inside a step: a failure (other than the spend cap)
// just means no email this time.
async function lookForEmail(p, market) {
  try {
    const r = await findEmail(p, market);
    return r.email ? { email: r.email, emailSource: r.source } : null;
  } catch (e) {
    if (e instanceof BudgetError) throw e;
    console.error('[autopilot] email search failed:', e?.message || e);
    return null;
  }
}

// Prospects that got this far without an email: search once for each. One
// already approved goes back to Approvals, since it would now get emails the
// operator hasn't approved. Companies turned down only for having no contact
// details are qualified again, once, so the search runs for them too.
async function findMissingEmails(done) {
  const state = await readState();
  const waiting = state.prospects
    .filter((p) => ['qualified', 'demo_ready', 'drafted', 'approved'].includes(p.stage) && !p.contact?.email && !p.emailSearchedAt)
    .slice(0, PER_TICK_FIND);
  for (const p of waiting) {
    const found = await lookForEmail(p, marketOf(state, p));
    await mutate((s) => {
      const q = findProspect(s, p.id);
      if (!q) return;
      q.emailSearchedAt = new Date().toISOString();
      if (!found || isSuppressed(s, found.email)) return;
      q.contact = { ...(q.contact || {}), ...found };
      const back = q.stage === 'approved';
      if (back) setStage(q, 'drafted');
      logEvent(s, `Found an email for ${q.name} (${found.email}, published on ${domainOf(found.emailSource)})${back ? '; it is back in Approvals since it will now get emails' : ''}.`, { prospectId: q.id });
    });
    if (found) done.push(`found email for ${p.name}`);
  }

  await mutate((s) => {
    const revive = s.prospects
      .filter((p) => p.stage === 'rejected' && [NO_CONTACT, OLD_NO_CONTACT].includes(p.fit?.reason) && (p.fit?.score || 0) >= s.settings.minFit && !p.revivedAt)
      .slice(0, PER_TICK_FIND);
    for (const p of revive) {
      setStage(p, 'found', { revivedAt: new Date().toISOString() });
      logEvent(s, `Looking again at ${p.name}: it was a fit but had no email on its website.`, { prospectId: p.id });
    }
  });
}

// ------------------------------------------------------------ qualify

async function qualifySome(done) {
  const state = await readState();
  const left = Math.min(PER_TICK.qualify, remaining(state.settings, usageToday(state), 'qualify'));
  if (!left) return;
  const batch = state.prospects.filter((p) => p.stage === 'found').sort(oldestFirst).slice(0, left);
  for (const p of batch) {
    try {
      const market = marketOf(state, p);
      const r = await qualify(p, market);
      // A good fit whose website shows no email: look for a published one.
      if (!r.blocked && r.verdict.score >= state.settings.minFit && !r.contact.email) {
        const found = await lookForEmail({ ...p, website: r.site.business.website || p.website }, market);
        if (found) Object.assign(r.contact, found);
      }
      await mutate((s) => {
        const q = findProspect(s, p.id);
        if (!q || q.stage !== 'found') return;
        addUsage(s, { qualify: 1 });
        const fit = { score: r.verdict.score, reason: r.verdict.reason, hook: r.verdict.hook };
        q.fit = fit;
        if (r.blocked) return compactRejected(q, r.blocked);
        if (r.verdict.score < s.settings.minFit) return compactRejected(q, r.verdict.reason);
        if (!r.contact.email && !r.linkedin) return compactRejected(q, NO_CONTACT);
        if (r.contact.email && isSuppressed(s, r.contact.email)) return compactRejected(q, 'On the do-not-contact list.');
        setStage(q, 'qualified', {
          industry: r.verdict.industry,
          contact: r.contact,
          linkedin: r.linkedin,
          website: r.site.business.website || q.website,
          profile: { business: r.site.business, language: r.site.language },
        });
        logEvent(s, `${q.name} is a fit (${fit.score}/100): ${fit.reason}`, { prospectId: q.id });
      });
      done.push(`qualified ${p.name}`);
    } catch (e) {
      if (e instanceof BudgetError) throw e;
      if (e instanceof SiteError) {
        // Someone else is reading a site right now: just try again later.
        if (e.code === 'busy') return;
        await mutate((s) => {
          const q = findProspect(s, p.id);
          if (q && q.stage === 'found') compactRejected(q, `Website could not be read: ${e.message}`);
        });
        continue;
      }
      await failed(p.id, 'qualifying', e);
    }
  }
}

// ------------------------------------------------------------ research

// The old lead sheet, so research doesn't bring back companies already called.
async function leadSheet() {
  if (g.__arvoLeadSheet) return g.__arvoLeadSheet;
  const out = { domains: [], names: [] };
  try {
    const text = await fs.readFile(path.join(process.cwd(), 'real_estate_leads_delhi_ncr.csv'), 'utf8');
    const [head, ...rows] = parseCsv(text);
    const bi = head.findIndex((h) => /business/i.test(h));
    const wi = head.findIndex((h) => /website/i.test(h));
    for (const r of rows) {
      if (bi >= 0 && r[bi]) out.names.push(nameKey(r[bi]));
      if (wi >= 0 && r[wi]) out.domains.push(r[wi].toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]);
    }
  } catch {
    // No sheet on this machine.
  }
  return (g.__arvoLeadSheet = out);
}

const ACTIVE = new Set(['found', 'qualified', 'demo_ready', 'drafted', 'approved']);

async function researchIfLow(done) {
  const state = await readState();
  const { settings } = state;
  if (remaining(settings, usageToday(state), 'researchRuns') <= 0) return;
  // Enough in the pipeline for about two days of sending: no need for more yet.
  const inPipeline = state.prospects.filter((p) => ACTIVE.has(p.stage)).length;
  if (inPipeline >= Math.max(10, settings.caps.emails * 2)) return;

  // Only markets that can be emailed now are worth researching.
  const market = chooseMarket(state.markets.filter((m) => !marketBlock(m, settings)), marketStats(state.prospects));
  if (!market) return;
  const known = knownCompanies(state, await leadSheet());
  const exclude = state.prospects.filter((p) => p.marketId === market.id).map((p) => p.name);
  const r = await researchMarket(market, { exclude });
  const fresh = freshCandidates(r.companies, known);

  await mutate((s) => {
    addUsage(s, { researchRuns: 1 });
    const m = s.markets.find((x) => x.id === market.id);
    if (m && r.brief) Object.assign(m, { brief: r.brief, briefAt: new Date().toISOString() });
    const now = new Date().toISOString();
    for (const c of fresh) {
      s.prospects.unshift({
        id: newId('prs'),
        marketId: market.id,
        name: c.name,
        domain: c.domain,
        website: c.website,
        city: c.city,
        why: c.why,
        linkedin: c.linkedin,
        stage: 'found',
        createdAt: now,
        updatedAt: now,
      });
    }
    logEvent(s, `Researched ${market.vertical}, ${market.city}: ${fresh.length} new compan${fresh.length === 1 ? 'y' : 'ies'} (${r.companies.length - fresh.length} already known).`);
  });
  done.push(`researched ${market.vertical}`);
}
