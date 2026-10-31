// Creating a demo with its first link and its agent: the Demos console and the
// autopilot both make demos this way.
//
// The demo is kept even when the agent can't be created yet (no key, no
// credits); `warning` then says why and the console offers a retry.
// Server-only.
import { createDemo } from './store';
import { syncDemoAgent } from './agent';
import { createShareLink } from '@/lib/loan/shareLinks';
import { keyStatus } from '@/lib/loan/settings';
import { friendlyError } from '@/lib/loan/elevenlabs';

// Returns { demo, link, warning }. Throws an Error with a display-ready
// message when the input is invalid (see sanitiseDemo in ./model.js).
export async function createDemoWithLink(input, { linkLabel = 'Main link', expiresInDays = 30 } = {}) {
  const demo = await createDemo(input);
  const link = await createShareLink({ demoId: demo.id, label: linkLabel, expiresInDays });

  let warning = '';
  if (!(await keyStatus()).configured) {
    warning = 'Saved. Add an ElevenLabs API key under Configuration to bring the agent online.';
  } else {
    try {
      await syncDemoAgent(demo.id);
    } catch (e) {
      console.error('[demos] agent sync failed:', e);
      warning = `Saved, but the agent is not live yet: ${friendlyError(e)}`;
    }
  }
  return { demo, link, warning };
}
