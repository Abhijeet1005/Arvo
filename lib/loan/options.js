// Loan-advisor settings: defaults, allowed values, and sanitising.
//
// Pure module (no server imports) so the dashboard and the API share one
// definition of what's configurable and what's valid.

// Which gender the agent speaks as. Hindi verbs agree with the speaker ("बोल रहा
// हूँ" for a man, "बोल रही हूँ" for a woman), so this decides the wording of the
// generated opening line and script (see ./prompt.js).
export const AGENT_GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

export const LANGUAGES = [
  { id: 'hi', label: 'Hindi · Hinglish' },
  { id: 'en', label: 'English (Indian)' },
];

// ElevenLabs only accepts certain voice models per agent language (checked
// against the live API): Hindi agents reject flash/turbo v2, English agents
// reject flash/turbo v2.5. The v4 family (Turbo and standard) is accepted for
// both languages.
//
// The FIRST entry of each list is the fallback used when a saved model isn't
// valid for the language, so keep the fastest Flash model first.
export const TTS_MODELS = {
  hi: [
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5 · fastest, plainer voice' },
    { id: 'eleven_v4_turbo', label: 'v4 Turbo · recommended, natural and fast' },
    { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 · balanced' },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2 · rich and warm' },
    { id: 'eleven_v3_conversational', label: 'v3 Conversational · most expressive' },
    { id: 'eleven_v4', label: 'v4 · highest quality, slower' },
  ],
  en: [
    { id: 'eleven_flash_v2', label: 'Flash v2 · fastest, plainer voice' },
    { id: 'eleven_v4_turbo', label: 'v4 Turbo · recommended, natural and fast' },
    { id: 'eleven_turbo_v2', label: 'Turbo v2 · balanced' },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2 · rich and warm' },
    { id: 'eleven_v3_conversational', label: 'v3 Conversational · most expressive' },
    { id: 'eleven_v4', label: 'v4 · highest quality, slower' },
  ],
};

// Models that ignore the speaking-pace setting. Measured against the live API:
// the same line comes out the same length at 0.8x, 1.0x and 1.2x on v4, v4
// Turbo and v3 Conversational (ElevenLabs documents that v4 has no Speed
// control). Flash, Turbo and Multilingual v2 do follow it.
const NO_SPEED_MODELS = ['eleven_v4', 'eleven_v4_turbo', 'eleven_v3_conversational'];
export function supportsSpeed(model) {
  return !NO_SPEED_MODELS.includes(model);
}

// The v3/v4 family can shape emotion and emphasis from context ("expressive
// mode"). ElevenLabs switches it on by default for these models, but only when
// an agent is created, so it has to be sent explicitly when the model changes.
const EXPRESSIVE_MODELS = ['eleven_v4', 'eleven_v4_turbo', 'eleven_v3_conversational'];
export function isExpressiveModel(model) {
  return EXPRESSIVE_MODELS.includes(model);
}

// Equivalent model when the language switches.
const TTS_SWAP = {
  eleven_flash_v2_5: 'eleven_flash_v2',
  eleven_flash_v2: 'eleven_flash_v2_5',
  eleven_turbo_v2_5: 'eleven_turbo_v2',
  eleven_turbo_v2: 'eleven_turbo_v2_5',
};

export function ttsModelFor(language, model) {
  const allowed = TTS_MODELS[language] || TTS_MODELS.hi;
  if (allowed.some((m) => m.id === model)) return model;
  const swapped = TTS_SWAP[model];
  return allowed.some((m) => m.id === swapped) ? swapped : allowed[0].id;
}

export const TURN_EAGERNESS = [
  { id: 'patient', label: 'Patient · waits longer before replying' },
  { id: 'normal', label: 'Normal' },
  { id: 'eager', label: 'Eager · replies as soon as they pause' },
];

export const SILENCE_HANGUP = [0, 15, 30, 60, 120, 300];
export const MAX_CALL_MINUTES = [3, 5, 10, 15, 20, 30];
export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

export const DEFAULT_VOICE_ID = 'zT03pEAEi0VHKciJODfn';

export const DEFAULT_SETTINGS = {
  // Persona
  companyName: 'Loan INC',
  agentName: 'Amit',
  // 'male' is the original script wording; settings saved before this option
  // existed simply read as male.
  agentGender: 'male',
  partnerBanks: 'PNB, SBI, HDFC',
  // Spoken when a customer asks "are you genuine?". Blank = no regulatory claim.
  regulatorLine: 'RBI registered company',
  // Intelligence (any LLM ElevenLabs hosts, including OpenAI's GPT models)
  llm: 'gemini-3.5-flash',
  reasoningEffort: 'minimal',
  temperature: 0.5,
  // Voice. Tuned for natural Hinglish on a live call: v4 Turbo is ElevenLabs'
  // model for real-time agents; stability 0.4-0.5 keeps delivery lively but
  // steady, and ~1.0x is the pace people actually talk at (ElevenLabs: most
  // natural conversation sits at 0.9-1.1x). Pace only applies to models that
  // support it (see supportsSpeed).
  voiceId: DEFAULT_VOICE_ID,
  ttsModel: 'eleven_v4_turbo',
  speed: 1,
  stability: 0.45,
  similarityBoost: 0.75,
  // Language & script ('' = use the generated default)
  language: 'hi',
  hinglishMode: true,
  firstMessage: '',
  prompt: '',
  // Call behaviour
  turnTimeout: 8, // seconds of silence before the agent re-engages (people pause to think or look things up)
  turnEagerness: 'normal',
  silenceHangup: 0, // seconds of silence before hanging up; 0 = never
  maxCallMinutes: 10,
  // One switch for the "sounds like a person" call mechanics (see payload.js):
  // "haan/hmm" doesn't cut the agent off, background voices are filtered, the
  // agent starts thinking before the customer fully stops, the opening line
  // isn't talked over, loan terms are recognised better, and "ek minute" makes
  // the agent wait quietly.
  naturalTuning: true,
};

// The delivery settings behind "Use recommended" in Agent Studio. Deliberately
// leaves the persona, voice, language and model choice alone.
export const NATURAL_PRESET = {
  ttsModel: DEFAULT_SETTINGS.ttsModel,
  speed: DEFAULT_SETTINGS.speed,
  stability: DEFAULT_SETTINGS.stability,
  similarityBoost: DEFAULT_SETTINGS.similarityBoost,
  temperature: DEFAULT_SETTINGS.temperature,
  turnTimeout: DEFAULT_SETTINGS.turnTimeout,
  turnEagerness: DEFAULT_SETTINGS.turnEagerness,
  naturalTuning: true,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export const SPEED = { min: 0.7, max: 1.2, step: 0.05 };
export const TURN_TIMEOUT = { min: 1, max: 30 };

// Placeholders the dashboard fills in on every call. ElevenLabs' own
// system__* variables are also allowed.
export const PER_CALL_VARIABLES = ['customer_name', 'customer_phone'];

export function unknownPlaceholders(text) {
  const unknown = new Set();
  for (const m of String(text || '').matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) {
    const name = m[1];
    if (!PER_CALL_VARIABLES.includes(name) && !name.startsWith('system__')) unknown.add(name);
  }
  return [...unknown];
}

export function settingsEqual(a = {}, b = {}) {
  return SETTING_KEYS.every((k) => a[k] === b[k]);
}

// Persona fields are dropped into the generated prompt, so they're kept to one
// plain line with no template syntax.
function line(v, max = 80) {
  return String(v ?? '')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Free text the operator writes on purpose (opening line, full prompt), so
// placeholders survive; only length and line endings are normalised.
function text(v, max) {
  return String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function num(v, min, max, fallback, step = 0.01) {
  const n = Number(v);
  if (v === '' || v === null || !Number.isFinite(n)) return fallback;
  const clamped = Math.min(max, Math.max(min, n));
  return Number((Math.round(clamped / step) * step).toFixed(2));
}

function oneOf(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

// Merge untrusted input over `base`, keeping only known, valid values.
export function sanitiseSettings(input = {}, base = DEFAULT_SETTINGS) {
  const out = { ...DEFAULT_SETTINGS, ...base };
  const has = (k) => input[k] !== undefined;

  for (const k of ['companyName', 'agentName', 'partnerBanks']) {
    if (has(k)) {
      const v = line(input[k]);
      if (v) out[k] = v;
    }
  }
  if (has('regulatorLine')) out.regulatorLine = line(input.regulatorLine);
  const genderIds = AGENT_GENDERS.map((g) => g.id);
  if (has('agentGender')) out.agentGender = oneOf(input.agentGender, genderIds, out.agentGender);
  // Also covers settings stored before this option existed, or a bad stored value.
  out.agentGender = oneOf(out.agentGender, genderIds, DEFAULT_SETTINGS.agentGender);

  if (has('llm')) {
    const v = String(input.llm || '').trim();
    if (/^[a-z0-9][a-z0-9._@-]{1,80}$/i.test(v)) out.llm = v;
  }
  if (has('reasoningEffort')) out.reasoningEffort = oneOf(input.reasoningEffort, ['', ...REASONING_EFFORTS], out.reasoningEffort);
  if (has('temperature')) out.temperature = num(input.temperature, 0, 1, out.temperature);

  if (has('voiceId')) {
    const v = String(input.voiceId || '').trim();
    if (/^[A-Za-z0-9]{10,40}$/.test(v)) out.voiceId = v;
  }
  if (has('speed')) out.speed = num(input.speed, SPEED.min, SPEED.max, out.speed);
  if (has('stability')) out.stability = num(input.stability, 0, 1, out.stability);
  if (has('similarityBoost')) out.similarityBoost = num(input.similarityBoost, 0, 1, out.similarityBoost);

  if (has('language')) out.language = oneOf(input.language, LANGUAGES.map((l) => l.id), out.language);
  if (has('hinglishMode')) out.hinglishMode = input.hinglishMode === true || input.hinglishMode === 'true';
  if (has('ttsModel')) out.ttsModel = String(input.ttsModel || '');
  out.ttsModel = ttsModelFor(out.language, out.ttsModel);

  if (has('firstMessage')) out.firstMessage = text(input.firstMessage, 500).replace(/\n+/g, ' ');
  if (has('prompt')) out.prompt = text(input.prompt, 50000);

  if (has('turnTimeout')) out.turnTimeout = Math.round(num(input.turnTimeout, TURN_TIMEOUT.min, TURN_TIMEOUT.max, out.turnTimeout, 1));
  if (has('turnEagerness')) out.turnEagerness = oneOf(input.turnEagerness, TURN_EAGERNESS.map((t) => t.id), out.turnEagerness);
  if (has('naturalTuning')) out.naturalTuning = input.naturalTuning === true || input.naturalTuning === 'true';
  // Settings saved before this switch existed read as on.
  if (typeof out.naturalTuning !== 'boolean') out.naturalTuning = DEFAULT_SETTINGS.naturalTuning;
  if (has('silenceHangup')) out.silenceHangup = oneOf(Number(input.silenceHangup), SILENCE_HANGUP, out.silenceHangup);
  if (has('maxCallMinutes')) out.maxCallMinutes = oneOf(Number(input.maxCallMinutes), MAX_CALL_MINUTES, out.maxCallMinutes);

  return out;
}

// Group an LLM id under its provider for the model picker.
export function providerOf(llm) {
  if (/^(gpt|o\d)/i.test(llm)) return 'OpenAI';
  if (/^gemini/i.test(llm)) return 'Google';
  if (/^claude/i.test(llm)) return 'Anthropic';
  return 'Other';
}

export const PROVIDER_ORDER = ['OpenAI', 'Google', 'Anthropic', 'Other'];
