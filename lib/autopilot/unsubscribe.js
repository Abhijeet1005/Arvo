// Unsubscribing from outreach: the link in every email's footer, and the
// one-click POST mail apps send from the List-Unsubscribe header.
// Server-only.
import { mutate, logEvent, suppress } from './store';
import { FINAL_STAGES } from './model';

export const UNSUB_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

// Returns { ok: true } when the token belongs to a prospect (also when they
// had already unsubscribed), { ok: false } otherwise.
export async function unsubscribe(token) {
  if (!UNSUB_TOKEN_RE.test(String(token))) return { ok: false };
  const { result } = await mutate((state) => {
    const p = state.prospects.find((x) => x.unsubToken === token);
    if (!p) return { ok: false };
    if (p.stage === 'unsubscribed') return { ok: true };
    // The whole company is left alone, not just this address.
    if (p.contact?.email) suppress(state, p.contact.email, { wholeDomain: true });
    const wasFinal = FINAL_STAGES.has(p.stage);
    p.stage = 'unsubscribed';
    p.unsubscribedAt = new Date().toISOString();
    p.updatedAt = new Date().toISOString();
    logEvent(state, `${p.name} unsubscribed${wasFinal ? '' : '; their follow-ups are cancelled'}.`, { kind: 'warning', prospectId: p.id });
    return { ok: true };
  });
  return result;
}
