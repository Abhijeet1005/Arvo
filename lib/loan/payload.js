// The ElevenLabs agent configuration for the loan advisor, built from settings.
//
// Pure module (no server imports): ./agent.js sends it, and it can be checked
// on its own. Everything here was confirmed against the live API; the
// non-obvious parts are called out where they matter.
import { resolvedPrompt, resolvedFirstMessage } from './prompt';
import { DATA_COLLECTION, EVALUATION_CRITERIA } from './analysis';
import { ttsModelFor, isExpressiveModel } from './options';
import { progressToolSpec } from './progress';

// ---------------------------------------------------------------- tools

const END_CALL_DESCRIPTION =
  'Hang up. Only call this in the same turn as a spoken final line (the closing "Thank you ... आपका दिन अच्छा रहे." or the do-not-call acknowledgement). Never call it right after the customer answers a question, and never without speaking first.';

const SKIP_TURN_DESCRIPTION =
  'Use when the customer asks you to wait ("एक minute", "रुकिए", "hold on") or is clearly talking to someone else. Say nothing and stay silent until they speak again.';

// IMPORTANT: system tools must sit inside `tools`. When a request carries a
// `tools` list (the update_progress client tool), ElevenLabs discards
// `built_in_tools`, so an end_call defined there silently vanishes and the
// agent can never hang up.
function toolList(tuned) {
  const tools = [
    // Silent bookkeeping for the live checklist: never speak before it.
    { ...progressToolSpec(), pre_tool_speech: 'off' },
    { type: 'system', name: 'end_call', description: END_CALL_DESCRIPTION, params: { system_tool_type: 'end_call' } },
  ];
  if (tuned) {
    tools.push({
      type: 'system',
      name: 'skip_turn',
      description: SKIP_TURN_DESCRIPTION,
      // After this long with no reply, the agent checks in instead of waiting forever.
      params: { system_tool_type: 'skip_turn', wait_timeout_secs: 15 },
    });
  }
  return tools;
}

// --------------------------------------------------- natural conversation

// Short things people say *while the agent is still talking* that mean "go on",
// not "stop". Matched exactly (case-insensitive), so a real sentence that merely
// contains "haan" still interrupts. ElevenLabs also merges its own curated
// list for the language.
const BACKCHANNELS = {
  hi: [
    'हाँ', 'हां', 'हाँ जी', 'हां जी', 'हाँ हाँ', 'हां हां', 'जी', 'जी जी', 'जी हाँ', 'जी हां', 'हम्म', 'हूँ', 'हूं',
    'अच्छा', 'अच्छा जी', 'ठीक है', 'ठीक है जी', 'ओके', 'ओके जी', 'सही', 'बिल्कुल',
    'haan', 'haan ji', 'haan haan', 'ji', 'ji ji', 'ji haan', 'hmm', 'hmm hmm', 'achha', 'accha', 'achha ji',
    'theek hai', 'theek hai ji', 'ok', 'okay', 'ok ji', 'yes', 'yeah', 'right', 'sahi', 'bilkul',
  ],
  en: ['yes', 'yeah', 'yep', 'ok', 'okay', 'hmm', 'mm-hmm', 'uh huh', 'right', 'sure', 'i see', 'got it', 'alright', 'haan', 'ji'],
};

// Words the speech recogniser should favour. Loan vocabulary is where Hinglish
// transcription slips most (EMI, CIBIL, PAN, lakh/crore), and the brand and
// bank names are what a customer repeats back.
const LOAN_TERMS = [
  'EMI', 'CIBIL', 'credit score', 'PAN', 'KYC', 'OTP', 'Aadhaar', 'UPI', 'salaried', 'self-employed',
  'lakh', 'crore', 'tenure', 'interest rate', 'personal loan', 'home loan', 'business loan', 'car loan', 'gold loan',
];

export function asrKeywords(s) {
  const banks = String(s.partnerBanks || '')
    .split(/,|\/|&|\band\b/i)
    .map((b) => b.trim())
    .filter((b) => b && b.length <= 30);
  const seen = new Set();
  const out = [];
  for (const word of [s.companyName, s.agentName, ...banks, ...LOAN_TERMS]) {
    const w = String(word || '').trim();
    const k = w.toLowerCase();
    if (!w || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out.slice(0, 30);
}

// --------------------------------------------------------------- payload

export function buildAgentPayload(s) {
  const language = s.language === 'en' ? 'en' : 'hi';
  const tuned = s.naturalTuning !== false;
  const model = ttsModelFor(language, s.ttsModel);

  return {
    name: `${s.companyName} · Loan advisor (${s.agentName})`,
    conversation_config: {
      agent: {
        first_message: resolvedFirstMessage(s),
        language,
        // With language 'hi', ElevenLabs answers in natural Hindi-English mix.
        hinglish_mode: language === 'hi' && s.hinglishMode,
        // Let the greeting finish: callers say "Hello?" the instant they pick
        // up, and a greeting cut off after two words sounds robotic.
        disable_first_message_interruptions: tuned,
        // Filled in per call from the dashboard; these only apply when testing
        // inside the ElevenLabs console.
        dynamic_variables: {
          dynamic_variable_placeholders: { customer_name: 'Rahul', customer_phone: 'not on file' },
        },
        prompt: {
          prompt: resolvedPrompt(s),
          llm: s.llm,
          // null clears it: ElevenLabs rejects reasoning for models without it.
          reasoning_effort: s.reasoningEffort || null,
          temperature: s.temperature,
          tools: toolList(tuned),
        },
      },
      tts: {
        model_id: model,
        voice_id: s.voiceId,
        // v4 / v4 Turbo ignore pace; sending it is harmless, and it applies
        // again as soon as a model that supports it is chosen.
        speed: s.speed,
        stability: s.stability,
        similarity_boost: s.similarityBoost,
        // ElevenLabs only turns this on when an agent is first created, so a
        // later switch to (or from) a v3/v4 model has to set it explicitly.
        expressive_mode: isExpressiveModel(model),
        // The model writes numbers as words ("पचास हज़ार") itself.
        text_normalisation_type: 'system_prompt',
      },
      turn: {
        // Re-engage after this much silence ("Hello, मेरी आवाज़ आ रही है?").
        turn_timeout: s.turnTimeout,
        turn_eagerness: s.turnEagerness,
        silence_end_call_timeout: s.silenceHangup > 0 ? s.silenceHangup : -1,
        // Wait patiently while someone spells out a PAN or phone number.
        spelling_patience: 'auto',
        // Start writing the reply while the customer is finishing, instead of
        // after. Trims the pause before the agent answers.
        speculative_turn: tuned,
        interruption_ignore_terms: tuned ? BACKCHANNELS[language] : [],
        interruption_ignore_term_languages: tuned ? [language] : [],
        merge_with_default_ignore_terms: tuned,
        // Deliberately OFF. ElevenLabs can speak a filler ("हम्म...") when a
        // reply is slow, but the filler is stored as something the agent said,
        // and the model then starts opening its later replies with it ("जी...",
        // "अच्छा..."). Measured: one slow first turn was enough, and a guard
        // rule in the prompt only reduced it. A rare pause beats a whole call
        // of mechanical openers. Sent explicitly so an old value is cleared.
        soft_timeout_config: { timeout_seconds: -1 },
      },
      asr: { keywords: tuned ? asrKeywords(s) : [] },
      // Ignore other people talking near the caller (TV, family) so they don't
      // cut the agent off or get transcribed as the customer.
      vad: { background_voice_detection: tuned },
      // Hard cap so a forgotten demo call can't drain a test key.
      conversation: { max_duration_seconds: s.maxCallMinutes * 60 },
    },
    platform_settings: {
      data_collection: DATA_COLLECTION,
      evaluation: { criteria: EVALUATION_CRITERIA },
      summary_language: 'en',
    },
  };
}
