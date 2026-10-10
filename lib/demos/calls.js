// Demo calls: registering them, refreshing them, and telling the operator.
//
// A call is registered by the visitor's browser when it connects (see
// app/api/loan/calls/route.js) and read back from ElevenLabs once the call is
// over. The visitor's browser can't be relied on to report the end of a call
// (tabs get closed), so a small background check keeps polling until the
// result is in and the alert, if enabled, has gone out.
import { listCalls, refreshCall, upsertCall, claimCallFlag, FINAL_STATUSES } from '@/lib/loan/calls';
import { claimDemoCall } from '@/lib/loan/shareLinks';
import { getDemo } from './store';
import { notificationsEnabled, notifyStarted, notifyFinished } from './notify';

const SWEEP_MS = 20 * 1000;
// A call is watched for this long after it starts. Longer than any demo call
// (capped at five minutes) plus ElevenLabs' processing time.
const WATCH_MS = 25 * 60 * 1000;

const g = globalThis;

// Like refreshCall, and also sends the "call finished" alert exactly once.
export async function refreshDemoCall(id) {
  const call = await refreshCall(id);
  if (call?.demoId && call.status === 'done' && notificationsEnabled()) {
    if (await claimCallFlag(call.id, 'notifiedEnd')) {
      const demo = await getDemo(call.demoId);
      await notifyFinished({ demo, call });
    }
  }
  return call;
}

async function sweep() {
  try {
    const now = Date.now();
    const pending = (await listCalls()).filter(
      (c) => c.demoId && !FINAL_STATUSES.has(c.status) && now - (Date.parse(c.startedAt || c.createdAt) || 0) < WATCH_MS
    );
    if (pending.length === 0) {
      clearInterval(g.__arvoSweeper);
      g.__arvoSweeper = null;
      return;
    }
    for (const call of pending) await refreshDemoCall(call.id).catch(() => {});
  } catch (e) {
    console.error('[demos] call check failed:', e?.message || e);
  }
}

// Start the background check if alerts are on and it is not running yet. It
// stops by itself when no demo call is waiting for its result.
export function ensureSweeper() {
  if (g.__arvoSweeper || !notificationsEnabled()) return;
  g.__arvoSweeper = setInterval(sweep, SWEEP_MS);
  g.__arvoSweeper.unref?.();
}

// Register a call that started on a demo link. Returns { ok: true } or
// { ok: false, status, error } for the route to send back.
export async function registerDemoCall({ link, conversationId, callerName }) {
  const demo = await getDemo(link.demoId);
  if (!demo) return { ok: false, status: 410, error: 'This demo is no longer available.' };

  const claim = await claimDemoCall(link.token, conversationId);
  if (!claim.ok) {
    const error = claim.reason === 'revoked' ? 'This link has been deactivated.' : 'This call was not started from this link.';
    return { ok: false, status: claim.reason === 'revoked' ? 410 : 403, error };
  }
  if (claim.repeat) return { ok: true };

  await upsertCall(conversationId, {
    customerName: callerName,
    agentId: demo.agentId || null,
    demoId: demo.id,
    templateId: demo.templateId,
    industry: demo.industry,
    businessName: demo.business.name,
    linkLabel: link.customerName,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  });

  // Alerts are a courtesy: never hold up or fail the call because of one.
  notifyStarted({ demo, linkLabel: link.customerName }).catch(() => {});
  ensureSweeper();
  return { ok: true };
}
