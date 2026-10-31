// Guarding the sending domain's reputation. Run on every tick, after the inbox
// has been read (it records bounces):
//   - too many bounces: sending is held and the operator told
//   - the sending domain appears on a public spam blocklist (checked daily):
//     held and told
//   - several unsubscribes in a day: told (worth a look at targeting/wording)
// A hold stays until the operator resumes sending from the dashboard.
// Server-only.
import { promises as dns } from 'node:dns';
import { readState, mutate, logEvent } from './store';
import { bounceBrake, unsubscribesToday, UNSUB_SPIKE, blocklistListed, domainOf, istDay } from './model';
import { senderAddress } from './channels/email';
import { alert } from './alerts';

const BLOCKLIST_EVERY_MS = 24 * 3_600_000;
// Lists that answer queries from a cloud server. (Spamhaus refuses them.)
const BLOCKLISTS = ['multi.surbl.org', 'multi.uribl.com'];

async function listedOn(domain) {
  const hits = [];
  for (const list of BLOCKLISTS) {
    try {
      const ips = await dns.resolve4(`${domain}.${list}`);
      if (ips.some(blocklistListed)) hits.push(list);
    } catch {
      // NXDOMAIN: not listed. Any other failure: unknown, try again tomorrow.
    }
  }
  return hits;
}

async function hold(reason) {
  let fresh = false;
  await mutate((s) => {
    if (s.meta.sendHold) return;
    s.meta.sendHold = { reason, at: new Date().toISOString() };
    logEvent(s, `Sending paused automatically: ${reason}`, { kind: 'error' });
    fresh = true;
  });
  if (fresh) {
    await alert('🛑 Autopilot paused sending to protect your domain', [
      reason,
      '',
      'Research, demos and drafts carry on; emails wait. Check the bounced or flagged prospects, then resume sending from the Autopilot page.',
    ]);
  }
}

export async function checkHealth() {
  const state = await readState();
  if (state.settings.sandbox) return;
  const now = Date.now();
  const meta = state.meta;

  const bounces = bounceBrake(state.prospects, now, meta.sendHoldClearedAt ? Date.parse(meta.sendHoldClearedAt) : 0);
  if (bounces) await hold(`${bounces} High bounce rates get a new domain flagged as spam.`);

  if (!meta.blocklistCheckedAt || now - Date.parse(meta.blocklistCheckedAt) >= BLOCKLIST_EVERY_MS) {
    const domains = [...new Set([senderAddress().split('@')[1], domainOf(state.settings.publicUrl).split('.').slice(-2).join('.')].filter(Boolean))];
    const found = [];
    for (const d of domains) for (const list of await listedOn(d)) found.push(`${d} on ${list}`);
    await mutate((s) => {
      s.meta.blocklistCheckedAt = new Date(now).toISOString();
      s.meta.blocklist = found;
    });
    if (found.length) await hold(`Your domain is on a spam blocklist: ${found.join(', ')}. Mail from it is likely being filtered.`);
  }

  const unsubs = unsubscribesToday(state.prospects, now);
  if (unsubs >= UNSUB_SPIKE && meta.unsubAlertDay !== istDay()) {
    await mutate((s) => {
      s.meta.unsubAlertDay = istDay();
    });
    await alert(`⚠️ ${unsubs} unsubscribes in the last day`, [
      'More people than usual asked to stop hearing from you. Sending continues, but the targeting or the wording may be off for one market.',
      'The Markets and Prospects tabs show which companies unsubscribed.',
    ]);
  }
}
