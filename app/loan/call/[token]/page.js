// Public, unauthenticated route — the link an operator hands to a customer
// (see app/components/loan/LoanLinks.jsx). No dashboard chrome renders here;
// components/dashboard-shell.jsx already bypasses itself for this path.
//
// Demo links (see lib/demos) can also be served from here, so a deployment
// whose proxy only exposes this path can still use them; app/d/[token] is the
// shorter address for the same page.
import PublicCallPage, { LinkUnavailable } from '@/app/components/loan/PublicCallPage';
import DemoCallPage, { DemoUnavailable } from '@/app/components/loan/DemoCallPage';
import { loadPublicLink, unavailableReason } from '@/lib/loan/publicLink';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  // Deliberately generic — never puts the customer's name in the tab title
  // or any OG data that could leak into a link preview. A demo link is for a
  // company, so its tab can carry the company's name.
  const { token } = await params;
  const result = await loadPublicLink(token).catch(() => null);
  if (result?.ok && result.data.demo) {
    return {
      title: `${result.data.demo.businessName} · AI voice assistant`,
      description: 'A live demo of an AI voice assistant.',
      robots: { index: false, follow: false },
      referrer: 'no-referrer',
    };
  }
  return { title: 'Loan Advisor', description: 'A quick call about your loan enquiry.', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function PublicLoanCallPage({ params }) {
  const { token } = await params;
  const result = await loadPublicLink(token).catch(() => ({ ok: false, status: 503 }));

  if (!result.ok) {
    const reason = unavailableReason(result);
    return result.kind === 'demo' ? <DemoUnavailable reason={reason} /> : <LinkUnavailable reason={reason} />;
  }

  const { data } = result;
  if (data.demo) return <DemoCallPage token={token} demo={data.demo} full={Boolean(data.full)} />;

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
