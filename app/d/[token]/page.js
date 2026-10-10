// Public, unauthenticated route — the link an operator sends to a company so
// its people can try their own AI voice assistant (see lib/demos). The short
// /d/ address is deliberately neutral; the room itself carries the company's
// branding. The proxy must let this path through without a login.
import PublicCallPage from '@/app/components/loan/PublicCallPage';
import DemoCallPage, { DemoUnavailable } from '@/app/components/loan/DemoCallPage';
import { loadPublicLink, unavailableReason } from '@/lib/loan/publicLink';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { token } = await params;
  const result = await loadPublicLink(token).catch(() => null);
  const name = result?.ok && result.data.demo ? result.data.demo.businessName : '';
  return {
    title: name ? `${name} · AI voice assistant` : 'AI voice assistant',
    description: 'A live demo of an AI voice assistant.',
    // The address is private: keep it out of search results and Referer headers.
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function DemoPage({ params }) {
  const { token } = await params;
  const result = await loadPublicLink(token).catch(() => ({ ok: false, status: 503 }));
  if (!result.ok) return <DemoUnavailable reason={unavailableReason(result)} />;

  const { data } = result;
  if (data.demo) return <DemoCallPage token={token} demo={data.demo} full={Boolean(data.full)} />;

  // A customer's loan link opened on the short address still works.
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
