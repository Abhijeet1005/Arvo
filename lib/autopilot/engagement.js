// A prospect trying their demo is the strongest signal there is: stop their
// follow-ups and tell the operator at once.
// Server-only.
import { mutate, logEvent } from './store';
import { alert } from './alerts';

// Called when a call starts on a demo link (lib/demos/calls.js). Nothing here
// throws into the call.
export async function onDemoCall(demoId) {
  try {
    let hot = null;
    await mutate((state) => {
      const p = state.prospects.find((x) => x.demoId === demoId);
      if (!p) return;
      const first = !p.engagedAt;
      const at = new Date().toISOString();
      p.lastDemoCallAt = at;
      p.demoCalls = (p.demoCalls || 0) + 1;
      if (!first) return;
      p.engagedAt = at;
      p.updatedAt = at;
      if (!['unsubscribed', 'bounced', 'replied'].includes(p.stage)) p.stage = 'engaged';
      logEvent(state, `${p.name} is trying their demo right now.`, { kind: 'win', prospectId: p.id });
      hot = {
        name: p.name,
        lines: [
          `${p.name} just started a call with the demo built for them. Their follow-up emails are stopped; reach out while it's fresh.`,
          p.contact?.email ? `Email: ${p.contact.email}` : '',
          p.contact?.phone ? `Phone: ${p.contact.phone}` : '',
          p.website ? `Website: ${p.website}` : '',
        ].filter(Boolean),
      };
    });
    if (hot) await alert(`🔥 ${hot.name} is trying their demo`, hot.lines);
  } catch (e) {
    console.error('[autopilot] could not record a demo call:', e?.message || e);
  }
}
