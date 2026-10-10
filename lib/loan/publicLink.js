// What a public link (a customer's loan link or a demo link) is allowed to
// show. One function for both the API route and the server-rendered pages, so
// the two can never disagree.
//
// Only ever returns what a non-technical visitor should see: never the note,
// the call ids, the expiry or the token itself.
import { getShareLink, isLinkUsable, TOKEN_RE } from './shareLinks';
import { getSettings } from './settings';
import { getDemo } from '@/lib/demos/store';
import { publicView } from '@/lib/demos/model';

const GONE = {
  revoked: 'This link has been deactivated. Please ask for a new one.',
  expired: 'This link has expired. Please ask for a new one.',
};

// -> { ok: true, data } | { ok: false, status, kind?: 'demo' | 'loan', reason?, error }
export async function loadPublicLink(token) {
  if (!TOKEN_RE.test(String(token ?? ''))) return { ok: false, status: 400, error: 'This link is invalid.' };

  const link = await getShareLink(token);
  if (!link) return { ok: false, status: 404, error: 'This link was not found.' };

  const kind = link.demoId ? 'demo' : 'loan';
  const usable = isLinkUsable(link);
  if (!usable.ok) return { ok: false, status: 410, kind, reason: usable.reason, error: GONE[usable.reason] || GONE.expired };

  // A demo link opens that demo's own branded room (see lib/demos).
  if (link.demoId) {
    const demo = await getDemo(link.demoId);
    if (!demo) return { ok: false, status: 410, kind, reason: 'revoked', error: 'This demo is no longer available.' };
    const full = (Number(link.sessions) || 0) >= (Number(link.maxSessions) || 0);
    return { ok: true, data: { demo: publicView(demo), full } };
  }

  const settings = await getSettings();
  return {
    ok: true,
    data: {
      customerName: link.customerName,
      customerPhone: link.customerPhone,
      companyName: settings.companyName,
      agentName: settings.agentName,
    },
  };
}

// The copy a page should show for a link that can't be opened.
export function unavailableReason({ status, reason }) {
  if (status === 410 && (reason === 'expired' || reason === 'revoked')) return reason;
  return status === 400 || status === 404 ? 'invalid' : 'unavailable';
}
