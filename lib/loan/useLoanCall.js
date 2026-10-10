'use client';

// Shared call mechanics for the loan advisor, used by both the operator's
// demo-call widget and the public client-facing share page.
//
// MUST be called from a component rendered inside an ElevenLabs
// <ConversationProvider> (from @elevenlabs/react) — this hook only calls
// useConversation(), it doesn't render the provider itself. See
// app/components/loan/LoanCall.jsx for the existing wrap-in-a-provider
// pattern this mirrors.
//
// Beyond connecting the call (mic permission, session token, WebRTC, live
// transcript — the same mechanics LoanCall.jsx already has), this also
// tracks live call-progress: the agent silently calls the `update_progress`
// client tool (lib/loan/progress.js) as it moves through the script, and we
// turn that into simple state a checklist UI can render.
import { useMemo, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { PROGRESS_STEP_IDS, UPDATE_PROGRESS_TOOL_NAME, stepIndex } from './progress';
import { stripAudioTags } from './speech';

const EMPTY_PROGRESS = { currentStepId: null, currentStepIndex: -1, completedStepIds: [], highlights: {} };

export function useLoanCall({ sessionUrl, dynamicVariables, onCallStarted, onCallEnded } = {}) {
  const [turns, setTurns] = useState([]);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  // True from the moment stop() is called until onDisconnect actually fires —
  // the SDK's own "disconnecting" status is transient and never exposed to
  // hook consumers (ConversationStatusProvider swallows it internally), so
  // this is derived locally instead of read off conversation.status.
  const [ending, setEnding] = useState(false);
  const callRef = useRef(null); // the live conversation id, once connected

  // update_progress only ever moves forward. An out-of-order or repeated
  // step, or a step id the agent hallucinated, is ignored rather than
  // regressing the checklist or crashing the call.
  function applyProgress(params) {
    try {
      const step = params?.step;
      if (!PROGRESS_STEP_IDS.includes(step)) return;
      const idx = stepIndex(step);
      setProgress((p) => {
        if (idx < p.currentStepIndex) return p;
        const completed = new Set(p.completedStepIds);
        for (let i = 0; i < idx; i++) completed.add(PROGRESS_STEP_IDS[i]);
        const highlight = typeof params?.highlight === 'string' ? params.highlight.trim().slice(0, 80) : '';
        return {
          currentStepId: step,
          currentStepIndex: idx,
          completedStepIds: [...completed],
          highlights: highlight ? { ...p.highlights, [step]: highlight } : p.highlights,
        };
      });
    } catch (e) {
      // A thrown error inside a clientTools handler could break the call —
      // never let a bad tool payload take the conversation down with it.
      console.error('[loan] update_progress handler failed:', e);
    }
  }

  const clientTools = useMemo(
    () => ({
      [UPDATE_PROGRESS_TOOL_NAME]: (params) => {
        applyProgress(params);
        // expects_response: false on the tool spec — no return value needed.
      },
    }),
    []
  );

  const conversation = useConversation({
    clientTools,
    onConnect: ({ conversationId }) => {
      callRef.current = conversationId;
      // The first step is simply "the call is connected": show it at once
      // instead of waiting for the agent's first progress report, which comes
      // after the person has replied to the greeting.
      applyProgress({ step: PROGRESS_STEP_IDS[0] });
      onCallStarted?.(conversationId);
    },
    onDisconnect: () => {
      const id = callRef.current;
      callRef.current = null;
      setEnding(false);
      if (id) onCallEnded?.(id);
    },
    onError: (message) => setError(typeof message === 'string' ? message : 'Voice connection error.'),
    onMessage: ({ message, role, source }) => {
      const text = stripAudioTags(message);
      if (!text) return;
      const who = role === 'user' || source === 'user' ? 'customer' : 'agent';
      setTurns((t) => [...t, { who, text }]);
    },
  });

  const { status: sdkStatus, isSpeaking } = conversation;
  // Real SDK status values are "disconnected" | "connecting" | "connected" |
  // "error" — there's no public "disconnecting" state — so the "ending" UI
  // state is driven by the local `ending` flag set in stop() instead.
  const status =
    ending
      ? 'ending'
      : preparing || sdkStatus === 'connecting'
        ? 'connecting'
        : sdkStatus === 'connected'
          ? 'connected'
          : 'idle';

  async function start() {
    setError('');
    setTurns([]);
    setProgress(EMPTY_PROGRESS); // fresh checklist for a fresh call
    setPreparing(true);
    try {
      // Ask for the mic up front so a blocked permission gets a clear message.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const res = await fetch(sessionUrl, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.conversationToken) throw new Error(data.error || 'Could not start the call.');

      callRef.current = null;
      await conversation.startSession({
        conversationToken: data.conversationToken,
        connectionType: 'webrtc',
        dynamicVariables,
      });
    } catch (e) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone access is blocked. Allow it in the browser, then try again.'
          : e?.message || String(e)
      );
    } finally {
      setPreparing(false);
    }
  }

  async function stop() {
    setEnding(true);
    try {
      // endSession() is fire-and-forget (returns void, not a promise) — the
      // real completion signal is the onDisconnect callback above, which
      // clears `ending`.
      conversation.endSession();
    } catch {
      setEnding(false);
      return;
    }
    // Safety net: if stop() was called before a session actually connected
    // (e.g. mid mic-permission prompt), the SDK never calls onDisconnect and
    // `ending` would otherwise stay stuck true forever.
    setTimeout(() => setEnding(false), 4000);
  }

  return { status, isSpeaking, turns, progress, error, start, stop };
}
