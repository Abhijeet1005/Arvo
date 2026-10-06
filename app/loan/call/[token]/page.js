// Public, unauthenticated route — the link an operator hands to a customer
// (see app/components/loan/LoanLinks.jsx). No dashboard chrome renders here;
// components/dashboard-shell.jsx already bypasses itself for this path.
import { headers } from 'next/headers';
import PublicCallPage, { LinkUnavailable } from '@/app/components/loan/PublicCallPage';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  // Deliberately generic — never puts the customer's name in the tab title
  // or any OG data that could leak into a link preview.
  return { title: 'Loan Advisor', description: 'A quick call about your loan enquiry.' };
}

// Server components can't call their own relative API routes without an
// absolute URL — build one from the incoming request's own host, so this
// works identically on localhost and once deployed, with no hardcoded origin.
async function fetchPublicLink(token) {
  try {
    const h = await headers();
    const host = h.get('host');
    if (!host) return { ok: false, status: 503, data: {} };
    const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const res = await fetch(`${proto}://${host}/api/loan/links/${token}/public`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 503, data: {} };
  }
}

export default async function PublicLoanCallPage({ params }) {
  const { token } = await params;
  const { ok, status, data } = await fetchPublicLink(token);

  if (!ok) {
    const reason = status === 410 && ['expired', 'revoked'].includes(data.reason) ? data.reason : status === 400 || status === 404 ? 'invalid' : 'unavailable';
    return <LinkUnavailable reason={reason} />;
  }

  return (
    <PublicCallPage
      token={token}
      customerName={data.customerName}
      customerPhone={data.customerPhone}
      companyName={data.companyName}
      agentName={data.agentName}
    />
  );
}
