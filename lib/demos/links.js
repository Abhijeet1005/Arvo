// How a demo link looks: its address, and the shape the console shows.
//
// Server-side only (reads the environment).
import { isLinkUsable } from '@/lib/loan/shareLinks';

// Where the public call room lives. `/d` is short and neutral; a deployment
// whose proxy only exposes the older `/loan/call` path can point
// ARVO_CALL_PATH there until the proxy is updated. Both paths serve the same
// page (and no other path does, so nothing else is accepted).
const CALL_PATHS = new Set(['/d', '/loan/call']);

export function callPath() {
  const raw = String(process.env.ARVO_CALL_PATH || '').trim().replace(/\/+$/, '');
  return CALL_PATHS.has(raw) ? raw : '/d';
}

export const demoLinkUrl = (token) => `${callPath()}/${token}`;

export function demoLinkView(link) {
  const usable = isLinkUsable(link);
  const sessions = Number(link.sessions) || 0;
  const maxSessions = Number(link.maxSessions) || 0;
  let status = usable.ok ? 'active' : usable.reason;
  if (usable.ok && maxSessions && sessions >= maxSessions) status = 'full';
  return {
    token: link.token,
    label: link.customerName,
    url: demoLinkUrl(link.token),
    status,
    sessions,
    maxSessions,
    calls: Array.isArray(link.callIds) ? link.callIds.length : 0,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    lastSessionAt: link.lastSessionAt || null,
  };
}
