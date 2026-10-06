// The call-progress checklist shown live to whoever is on the call.
//
// Both the operator's demo-call widget and the public client-facing share
// page use this: the agent reports its position via the `update_progress`
// client tool (see progressToolSpec below) each time it moves to a new step,
// and the browser turns that into a simple checklist — no transcript, no
// jargon, nothing that would overwhelm a non-technical viewer.
//
// Steps mirror the CALL FLOW sections in lib/loan/prompt.js. Pure module: no
// server imports, so both API routes and client components can use it.

export const PROGRESS_STEPS = [
  { id: 'opened', label: 'Call connected' },
  { id: 'discovery', label: 'Understanding what you need' },
  { id: 'profile', label: 'Gathering your details' },
  { id: 'positioning', label: 'Comparing bank options' },
  { id: 'handoff', label: 'Connecting you with a specialist' },
  { id: 'close', label: 'Wrapping up' },
];

export const PROGRESS_STEP_IDS = PROGRESS_STEPS.map((s) => s.id);

export function stepIndex(id) {
  return PROGRESS_STEP_IDS.indexOf(id);
}

export const UPDATE_PROGRESS_TOOL_NAME = 'update_progress';

// The ElevenLabs client-tool definition for conversation_config.agent.prompt.tools[].
// Confirmed live against the API: the shape is flat (not nested under a
// `client` key), the schema key is `parameters` (not `params` like system
// tools use), and every property needs its own `description`.
export function progressToolSpec() {
  return {
    type: 'client',
    name: UPDATE_PROGRESS_TOOL_NAME,
    description:
      "Silently report where you are in the call so the customer's screen can show live progress. Call this once at the start of each new step, right before you begin that part of the conversation. Never mention this tool out loud.",
    expects_response: false,
    parameters: {
      type: 'object',
      required: ['step'],
      properties: {
        step: {
          type: 'string',
          enum: PROGRESS_STEP_IDS,
          description: 'Which part of the call you are starting now.',
        },
        highlight: {
          type: 'string',
          description:
            'Optional: one short, friendly phrase (under 8 words) about what you just learned, safe to display on screen — e.g. "Home renovation loan" or "Looking for around 2 lakh". Never include PAN, phone, account numbers, OTPs, or any other sensitive detail.',
        },
      },
    },
  };
}
