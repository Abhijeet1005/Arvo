// Building a prospect's demo: their own branded voice agent and a link to it,
// made from their website the same way the Demos console makes one.
// Server-only.
import { createDemoWithLink } from '@/lib/demos/create';
import { demoLinkUrl } from '@/lib/demos/links';
import { deleteDemo } from '@/lib/demos/store';
import { removeDemoAgent } from '@/lib/demos/agent';
import { revokeLinksForDemo } from '@/lib/loan/shareLinks';

async function discardDemo(demo) {
  await revokeLinksForDemo(demo.id);
  if (demo.agentId) await removeDemoAgent(demo).catch(() => {});
  await deleteDemo(demo.id);
}

// Returns { demoId, linkToken, demoUrl }. Throws when the demo or its agent
// can't be made: an email must never point at a demo that doesn't answer.
export async function buildDemo(prospect, market, publicUrl) {
  if (!publicUrl) throw new Error('The public address of this dashboard is not known yet.');
  const { demo, link, warning } = await createDemoWithLink(
    {
      templateId: 'assistant',
      industry: prospect.industry || market.industry || 'generic',
      business: { ...prospect.profile.business, website: prospect.website },
      agent: { language: prospect.profile.language === 'hi' ? 'hi' : 'en' },
      notes: `Autopilot · ${market.vertical}`.slice(0, 300),
    },
    { linkLabel: 'Autopilot' }
  );
  if (warning) {
    // Don't leave a half-made demo behind; the next attempt starts clean.
    await discardDemo(demo).catch((e) => console.error('[autopilot] could not discard a demo:', e?.message || e));
    throw new Error(warning.replace(/^Saved[.,]\s*(but\s*)?/i, ''));
  }
  return { demoId: demo.id, linkToken: link.token, demoUrl: `${publicUrl}${demoLinkUrl(link.token)}` };
}
