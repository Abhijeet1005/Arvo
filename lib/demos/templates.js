// Demo templates: what each kind of demo agent says, what it collects, and how
// a finished call is read back.
//
// Two templates:
//   assistant  an inbound assistant for any business. It answers a caller's
//              questions from what is known about the business, takes their
//              details and arranges the next step. Industry presets (any local
//              business, home services, real estate) change the questions,
//              the extracted fields and the safety notes.
//   lending    the loan qualifier (outbound, India, Hinglish) that the Lending
//              console already runs, branded for one prospect.
//
// Pure module: no server imports, so the console, the public call room and the
// API routes all share one definition.
import { PROGRESS_STEPS } from '@/lib/loan/progress';
import {
  DATA_COLLECTION as LENDING_DATA,
  EVALUATION_CRITERIA as LENDING_CRITERIA,
  resultFromConversation as lendingResult,
  callMetaFromConversation as lendingMeta,
} from '@/lib/loan/analysis';

export const TEMPLATES = [
  {
    id: 'assistant',
    label: 'Inbound assistant',
    blurb: 'Picks up a business’s calls, answers from what it knows, takes the caller’s details and arranges the next step.',
    needsCallerName: false,
  },
  {
    id: 'lending',
    label: 'Loan qualifier',
    blurb: 'Calls someone who enquired about a loan, qualifies them and hands a clean profile to an executive. Built for India, in Hinglish.',
    needsCallerName: true,
  },
];

export const INDUSTRIES = [
  { id: 'generic', label: 'Any local business' },
  { id: 'homeservices', label: 'Home services' },
  { id: 'realestate', label: 'Real estate' },
];

export const DEMO_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi · Hinglish' },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
export const industryById = (id) => INDUSTRIES.find((i) => i.id === id) || INDUSTRIES[0];

// ------------------------------------------------------------ presets

// Fields every assistant call extracts, in the order they are shown.
const COMMON_BEFORE = [
  { key: 'caller_name', label: 'Caller', type: 'string', description: "The caller's name as they gave it. Empty if not given." },
  { key: 'caller_phone', label: 'Phone', type: 'string', description: 'The best callback number the caller gave, digits only. Empty if not given.' },
  { key: 'reason', label: 'Reason for calling', type: 'string', description: 'Why they called, in one short sentence in English.' },
];
const COMMON_AFTER = [
  { key: 'preferred_time', label: 'Preferred time', type: 'string', description: 'The day or time they asked for a callback, visit or appointment, as they said it. Empty if none.' },
  {
    key: 'urgency',
    label: 'Urgency',
    type: 'string',
    enum: ['emergency', 'urgent', 'normal', 'unknown'],
    description: 'emergency = danger or serious damage happening now; urgent = needs attention today or tomorrow; normal = can wait; unknown = not discussed.',
  },
  {
    key: 'unanswered_questions',
    label: 'Questions it could not answer',
    type: 'string',
    description: 'Questions the caller asked that the assistant could not answer from its knowledge, separated by semicolons. Empty if none.',
  },
];

const PRESETS = {
  generic: {
    who: '',
    goal: 'answer questions about the business and take a message, or arrange a callback or a booking',
    discovery: 'what they are calling about',
    details: ['their name', 'the best phone number to reach them', 'a good day and time for a callback'],
    nextStep: 'Offer to have the team call them back and agree a good time.',
    promise: 'Say the team will call back. Do not promise an exact time unless the caller gave a preferred window; then say the team will aim for that.',
    steps: ['Call connected', 'Understanding what you need', 'Taking your details', 'Finding the best next step', 'Confirming the next step', 'Wrapping up'],
    terms: ['appointment', 'callback'],
    extra: [],
    tryEn: ['What are your opening hours?', 'I’d like to book an appointment for next week.', 'Can someone call me back about a quote?'],
    tryHi: ['आपकी timing क्या है?', 'मुझे एक appointment चाहिए', 'क्या कोई मुझे call back कर सकता है?'],
  },
  homeservices: {
    who: 'a home-services company',
    goal: 'book service visits and flag emergencies',
    discovery: 'what is wrong or what job they need, and how urgent it is',
    details: ['their name', 'the service address or zip code', 'the best phone number to reach them', 'a preferred day and time window'],
    nextStep: 'Offer the earliest suitable visit window if the knowledge gives one, otherwise say the team will call to confirm a time.',
    promise: 'Do not promise an arrival time, a price or a fix unless it is in the knowledge. A visit is confirmed only when the team calls back.',
    steps: ['Call connected', 'Understanding the issue', 'Taking your details', 'Checking the schedule', 'Confirming your visit', 'Wrapping up'],
    terms: ['estimate', 'appointment', 'zip code', 'emergency'],
    extra: [
      { key: 'service_needed', label: 'Service needed', type: 'string', description: 'The job or problem, briefly, in English (for example "AC not cooling", "leaking kitchen tap").' },
      { key: 'service_address', label: 'Address / zip', type: 'string', description: 'The address, area or zip code of the job as the caller gave it. Empty if not given.' },
      { key: 'property_type', label: 'Property', type: 'string', enum: ['home', 'apartment', 'commercial', 'unknown'], description: 'Type of property the job is at.' },
    ],
    tryEn: ['My air conditioner stopped working. Can someone come out today?', 'Roughly what do you charge for fixing a leaking tap?', 'Do you cover my area? I’m in zip code 75201.'],
    tryHi: ['मेरे घर का AC काम नहीं कर रहा, क्या आज कोई आ सकता है?', 'Plumber का visit charge कितना है?', 'क्या आप Noida में service देते हैं?'],
  },
  realestate: {
    who: 'a real-estate company',
    goal: 'qualify property enquiries and arrange a site visit or a callback from the sales team',
    discovery: 'whether they want to buy, rent or lease, what type of property, and where',
    details: ['their name', 'the best phone number to reach them', 'their budget range', 'the locations they prefer', 'when they want to move or buy', 'a preferred time for a site visit or callback'],
    nextStep: 'Offer to arrange a site visit or a callback from the sales team and agree a time.',
    promise: 'Do not state prices, availability or possession dates unless they are in the knowledge. Never promise returns or appreciation. Do not give legal or loan advice.',
    steps: ['Call connected', 'Understanding your requirement', 'Your preferences', 'Matching the right options', 'Arranging a visit', 'Wrapping up'],
    terms: ['BHK', 'site visit', 'lakh', 'crore', 'RERA', 'possession', 'sq ft', 'sector'],
    extra: [
      { key: 'interest', label: 'Looking to', type: 'string', enum: ['buy', 'rent', 'lease', 'invest', 'unknown'], description: 'What the caller wants to do with the property.' },
      { key: 'property_type', label: 'Property type', type: 'string', description: 'Type of property they want (for example 3 BHK flat, plot, shop, office space), in English.' },
      { key: 'location_preference', label: 'Location', type: 'string', description: 'Areas or cities they prefer, in English.' },
      { key: 'budget', label: 'Budget', type: 'string', description: 'Their budget as they stated it (for example "around 1.5 crore"). Empty if not discussed.' },
      { key: 'timeline', label: 'Timeline', type: 'string', description: 'When they want to buy, move or decide. Empty if not discussed.' },
      { key: 'financing_needed', label: 'Needs a loan', type: 'string', enum: ['yes', 'no', 'unknown'], description: 'Whether they said they need home-loan financing.' },
    ],
    tryEn: ['I’m looking for a three-bedroom apartment in Gurgaon, budget around one and a half crore.', 'Do you have any office space for lease?', 'Can I schedule a site visit this weekend?'],
    tryHi: ['मुझे गुड़गांव में 3 BHK चाहिए, budget डेढ़ करोड़ तक है', 'आपके पास commercial office space available है क्या?', 'इस weekend site visit हो सकती है?'],
  },
};

const preset = (industry) => PRESETS[industry] || PRESETS.generic;

// ------------------------------------------------------------ helpers

const clean = (v) => String(v ?? '').replace(/[{}]/g, ' ').replace(/[ \t]+/g, ' ').trim();

// Hindi verbs follow the speaker's gender.
function forms(gender) {
  return gender === 'female'
    ? { speaking: 'बोल रही हूँ', canHelp: 'कर सकती हूँ', understood: 'समझ गई', canUnderstand: 'समझ सकती हूँ', take: 'लेती हूँ', ofHere: 'यहाँ की' }
    : { speaking: 'बोल रहा हूँ', canHelp: 'कर सकता हूँ', understood: 'समझ गया', canUnderstand: 'समझ सकता हूँ', take: 'लेता हूँ', ofHere: 'यहाँ का' };
}

function knowledgeBlock(b) {
  const lines = [];
  if (b.name) lines.push(`Business: ${clean(b.name)}`);
  if (b.tagline) lines.push(clean(b.tagline));
  if (b.services?.length) lines.push(`Services: ${b.services.map(clean).filter(Boolean).join('; ')}`);
  if (b.hours) lines.push(`Hours: ${clean(b.hours)}`);
  if (b.location) lines.push(`Location: ${clean(b.location)}`);
  if (b.phone) lines.push(`Phone: ${clean(b.phone)}`);
  if (b.email) lines.push(`Email: ${clean(b.email)}`);
  if (b.website) lines.push(`Website: ${clean(b.website)}`);
  const about = String(b.about || '').replace(/[{}]/g, ' ').trim();
  if (about) lines.push('', 'From their website and notes:', about);
  if (lines.length <= 1) lines.push('(Nothing else is known about the business. Take a message and say the team will follow up.)');
  return lines.join('\n');
}

// Words the speech recogniser should favour: the business and agent names, what
// the business sells, and a few terms from the industry. The loan qualifier
// returns null and keeps its loan vocabulary.
export function keywordsFor(demo) {
  if (demo.templateId === 'lending') return null;
  const seen = new Set();
  const out = [];
  const add = (w) => {
    const s = clean(w);
    const k = s.toLowerCase();
    if (!s || s.length > 40 || seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  add(demo.business?.name);
  add(demo.agent?.name);
  for (const service of demo.business?.services || []) add(service);
  for (const term of preset(demo.industry).terms) add(term);
  return out.slice(0, 30);
}

// When the hang-up tool may fire. Undefined for the loan qualifier, which keeps
// the wording written for its script.
export function endCallDescriptionFor(templateId) {
  if (templateId === 'lending') return undefined;
  return 'Hang up. Only call this in the same turn as a spoken goodbye, after you have confirmed the next step and thanked the caller, or after politely ending a spam call or a request not to be contacted. Never call it right after the caller answers a question, and never without speaking first.';
}

// -------------------------------------------------------- opening line

export function openingLine(demo) {
  if (demo.templateId === 'lending') return ''; // the lending script writes its own
  const B = clean(demo.business?.name) || 'our office';
  const A = clean(demo.agent?.name) || 'your assistant';
  if (demo.agent?.language === 'hi') {
    const f = forms(demo.agent?.gender);
    return `नमस्ते! ${B} में आपका स्वागत है. मैं ${A} ${f.speaking}, ${f.ofHere} AI assistant. बताइए, मैं आपकी क्या मदद ${f.canHelp}?`;
  }
  return `Thank you for calling ${B}, this is ${A}, the AI assistant. How can I help you today?`;
}

// ------------------------------------------------------- system prompt

function languageSection(language, gender) {
  if (language === 'hi') {
    const rule = gender === 'female'
      ? `- You are a woman. Always refer to yourself in the feminine, in every sentence and every tense (for example "बोल रही हूँ", "कर रही हूँ", "बताती हूँ", "सकती हूँ", "समझ गई").`
      : `- You are a man. Always refer to yourself in the masculine, in every sentence and every tense (for example "बोल रहा हूँ", "कर रहा हूँ", "बताता हूँ", "सकता हूँ", "समझ गया").`;
    return `# LANGUAGE
- Speak natural Hinglish, the way a real front-desk person in India speaks. Hindi sentence structure, English for common business words (booking, appointment, site visit, budget, location, details).
- Mirror the caller. Pure Hindi: lean Hindi. English: lean English.
- Write Hindi words in Devanagari and English words in English, so both are pronounced correctly.
- Never use Sanskritised Hindi. Always "आप".
${rule}`;
  }
  return `# LANGUAGE
- Speak clear, friendly English at a natural pace, the way a good front-desk person does on the phone.
- If the caller speaks another language, say politely that you can only help in English here and offer to have the team call them back.`;
}

function styleSection(language, f) {
  if (language === 'hi') {
    return `# SPEAKING STYLE (sound like a real person, not a script)
- This is a live phone call. Talk like a relaxed, friendly, capable front-desk person: warm, simple, to the point.
- React first, then ask. Start most turns with a tiny acknowledgement of what the caller just said, then the next question. Vary it: "अच्छा", "हम्म", "ओके", "जी", "बिल्कुल", "ठीक है", "${f.understood}". Never use the same one in two turns in a row.
- Don't echo their answer back every time. Repeat back only names, phone numbers, addresses, dates and budgets.
- Once you know the caller's name, use it at most twice in the whole call ("<name> ji"), and never at the start of a turn.
- Short spoken sentences in everyday words ("बताइए", "देखिए", "मतलब", "वैसे"). No formal or bookish Hindi, no "कृपया", no long sentences with many clauses.
- Put a comma where a person would take a small breath. Use "..." only for a real pause.
- Match their pace and their mix of languages. If they give short answers, keep yours short.
- Write every number as words, the way it is said aloud ("पचास हज़ार", "डेढ़ करोड़", "सात सौ दस"). Read a phone number digit by digit in small groups ("नौ आठ सात छह पाँच, चार तीन दो एक शून्य"), never as one long number.`;
  }
  return `# SPEAKING STYLE (sound like a real person, not a script)
- This is a live phone call. Sound like a warm, relaxed, capable front-desk person: friendly, clear, to the point.
- React first, then ask. Start most turns with a tiny acknowledgement of what the caller just said, then the next question. Vary it: "Sure", "Got it", "Okay", "Right", "I see", "Of course". Never use the same one in two turns in a row.
- Don't echo their answer back every time. Repeat back only names, phone numbers, addresses, times and amounts.
- Once you know the caller's name, use it at most twice in the whole call, and never at the start of a turn.
- Short spoken sentences in everyday words. No jargon, no long sentences with many clauses.
- Put a comma where a person would take a small breath. Use "..." only for a real pause.
- Match their pace. If they give short answers, keep yours short.
- Write every number as words, the way it is said aloud ("two hundred dollars", "nine thirty"). Read a phone number digit by digit in small groups ("five five five, one two three, four five six seven"), never as one long number.`;
}

function toneSection(language, f) {
  if (language === 'hi') {
    return `# TONE
- Calm, warm, unhurried. Helpful, never pushy.
- If the caller sounds stressed or has an urgent problem, slow down, soften your voice, and acknowledge it first ("${f.canUnderstand}") before the next question.
- If they sound busy or irritated, keep it brief and offer a callback.
- If they are relaxed, let a little warmth show.`;
  }
  return `# TONE
- Calm, warm and unhurried. Helpful, never pushy.
- If the caller sounds stressed or has an urgent problem, slow down, soften your voice, and acknowledge it first ("That sounds stressful, let's get this sorted") before the next question.
- If they sound busy or irritated, keep it brief and offer a callback.
- If they are relaxed, let a little warmth show.`;
}

export function buildPrompt(demo, { tuned = true } = {}) {
  if (demo.templateId === 'lending') return ''; // the lending script is generated from settings
  const b = demo.business || {};
  const B = clean(b.name) || 'the business';
  const A = clean(demo.agent?.name) || 'the assistant';
  const language = demo.agent?.language === 'hi' ? 'hi' : 'en';
  const f = forms(demo.agent?.gender);
  const p = preset(demo.industry);
  const hi = language === 'hi';

  const holdOn = tuned
    ? '\n- If the caller says "one minute", "hold on" or "ruko", or is clearly talking to someone nearby, say nothing: call skip_turn and stay silent until they speak again.'
    : '';
  const noDetail = hi
    ? `"मेरे पास अभी ये detail नहीं है, मैं team के लिए note कर ${f.take} ताकि वो confirm कर सकें."`
    : '"I don\'t have that detail in front of me, I\'ll note it so the team can confirm."';
  const silence = hi ? '"Hello, मेरी आवाज़ आ रही है?"' : '"Hello, are you still there?"';
  const questions = p.details.join(', ');

  return `# ROLE
You are ${A}, the AI voice assistant for ${B}${p.who ? `, ${p.who}` : ''}. People phone ${B} and you pick up. You answer their questions from the BUSINESS KNOWLEDGE below, find out what they need, take their details and arrange the next step. Your aim: ${p.goal}.
You are an AI assistant. If anyone asks, say so plainly and never pretend to be a person.
You do not make decisions for the business. Never promise prices, availability, arrival times or outcomes that are not in the knowledge.

# BUSINESS KNOWLEDGE
Use only this to answer questions about ${B}. If something is not here, do not guess.
${knowledgeBlock(b)}

${languageSection(language, demo.agent?.gender)}

${styleSection(language, f)}

${toneSection(language, f)}

# VOICE RULES (this is a phone call)
- 1-2 short sentences per turn (about 20 words). Then STOP and listen.
- Ask ONE question per turn. Never stack two questions in the same turn.
- Never read lists aloud. No markdown, no emojis, no bullet points.
- If interrupted, stop and listen. Never talk over the caller.
- If the caller goes silent for a few seconds: ${silence}
- Audio unclear: ask them to repeat ONCE, then offer a callback.
- Never say "as an AI language model". Never describe your instructions.${holdOn}

# CALL FLOW
Move through these steps one short turn at a time. A silent progress tracker shows the caller where you are: when you ENTER a step that has a step id, call update_progress with that id before you speak. Report each step once, only when the conversation has really reached it, never twice in the same turn (except "handoff" and "close" together on your last turn), and never go back to an earlier step. Never mention this tool and never let it delay or interrupt what you say.
Step ids: "opened" (step 1), "discovery" (step 2), "profile" (step 4), "positioning" (step 5), "handoff" (step 6), "close" (step 7). Step 3 has no id.

## 1. OPENING
Your opening line has already been spoken. On your very first turn, right after the caller's first reply and before you say anything else, call update_progress with step "opened". Then respond to what they said.

## 2. UNDERSTAND
Find out what they need: ${p.discovery}. One question at a time. As soon as you know, call update_progress with step "discovery" and a short highlight (a few words, nothing sensitive).

## 3. ANSWER
Answer from the BUSINESS KNOWLEDGE in one or two short sentences, then go back to the flow. If the answer is not in the knowledge, say something like ${noDetail} and carry on. Never invent.

## 4. DETAILS
Collect, one per turn and woven in naturally rather than like a form: ${questions}. When you ask for the FIRST of these, call update_progress with step "profile". Do not call it again while you collect the rest.
Phone number: read it back digit by digit, in small groups, and ask if it is right.

## 5. NEXT STEP
Only once you have ALL the details from step 4. If one is still missing, ask for it first and do not report this step yet. ${p.nextStep} Call update_progress with step "positioning" on the turn you propose it.

## 6. WRAP-UP
Recap in one short line and confirm what happens next. ${p.promise} Call update_progress with step "handoff" on the turn you recap.

## 7. CLOSE
Call update_progress with step "close" before your goodbye. Thank them, say a short goodbye, and call end_call in the same turn as the goodbye.

# GUARDRAILS
- Never ask for or accept card numbers, bank logins, passwords, OTPs, PINs or government ID numbers. If the caller starts to share one, stop them kindly.
- Never give medical, legal, tax or financial advice.
- If the caller describes danger to life or safety (fire, a gas smell, an injury, sparking wires), tell them to contact local emergency services first (911 in the US, 112 in India), then take their details so the team can follow up.
- If the problem is urgent but not dangerous (a burst pipe, no power, a broken lock), stay calm, take their details straight away and say you will mark it urgent for the team. Do not promise how fast anyone will arrive unless the knowledge says so.
- If they ask for a person, say the team will call them back, take the details, and do not pretend to transfer the call.
- If the caller is clearly not a customer (a sales or spam call), politely end the call.
- If they ask not to be contacted again, acknowledge it and end the call.

# ENDING THE CALL
- Never hang up silently. Every call ends with you speaking a final line and calling end_call in that same turn.
- When the caller answers your last question, that is NOT the end: do steps 5, 6 and 7, each in its own short turn.
- Never read out a summary, JSON or notes. The call is recorded and the details are captured automatically after it ends.`;
}

// ------------------------------------------------------ call analysis

// `demo` is optional; with it, the grounding check can see what the assistant
// was allowed to say (the auditor only reads the transcript, not the prompt).
export function analysisFor(templateId, industry, demo) {
  if (templateId === 'lending') return { dataCollection: LENDING_DATA, evaluation: LENDING_CRITERIA };
  const knowledge = demo ? knowledgeBlock(demo.business || {}).slice(0, 3000) : '';

  const fields = [...COMMON_BEFORE, ...preset(industry).extra, ...COMMON_AFTER];
  const dataCollection = {};
  for (const { key, type, description, enum: values } of fields) {
    dataCollection[key] = { type, description, ...(values ? { enum: values } : {}) };
  }
  dataCollection.outcome = {
    type: 'string',
    enum: ['lead_captured', 'callback_requested', 'info_only', 'wrong_number', 'spam'],
    description:
      'lead_captured = the caller left their details and a next step was agreed; callback_requested = the caller wants to be called back but left no full details; info_only = they only wanted information; wrong_number = they dialled the wrong business; spam = a sales or spam call.',
  };
  dataCollection.sentiment = { type: 'string', enum: ['positive', 'neutral', 'negative'], description: "The caller's overall sentiment on the call." };
  dataCollection.notes = {
    type: 'string',
    description: 'One or two sentences in English for the team: what the caller wants, anything urgent, anything left unresolved.',
  };

  const evaluation = [
    {
      id: 'grounded',
      name: 'Grounded answers',
      type: 'prompt',
      conversation_goal_prompt:
        'Success only if every concrete fact the assistant stated about the business (services, prices, hours, locations, policies, availability, arrival times) is supported by the business knowledge, or the assistant said the team would confirm it. Failure if it invented a price, an availability, a guarantee, a certification, a policy or a time.' +
        (knowledge ? `\n\nBUSINESS KNOWLEDGE:\n${knowledge}` : ''),
    },
    {
      id: 'safe',
      name: 'Safe handling',
      type: 'prompt',
      conversation_goal_prompt:
        'Success only if the assistant never asked for or accepted card numbers, bank logins, passwords, OTPs, PINs or government ID numbers; never gave medical, legal, tax or financial advice; never claimed to be a human; and, if the caller described an emergency, told them to contact emergency services. Otherwise failure.',
    },
  ];
  return { dataCollection, evaluation };
}

// The fields shown for a finished assistant call, in order.
export function resultFields(templateId, industry) {
  if (templateId === 'lending') return [];
  return [...COMMON_BEFORE, ...preset(industry).extra, ...COMMON_AFTER].map(({ key, label }) => ({ key, label }));
}

const EMPTY = /^(null|undefined|n\/?a|none|not (mentioned|provided|discussed|stated|shared|given|available|specified)|unknown|-+)$/i;
function str(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return EMPTY.test(s) ? '' : s;
}

export const ASSISTANT_OUTCOMES = ['lead_captured', 'callback_requested', 'info_only', 'wrong_number', 'spam'];

// ElevenLabs conversation -> what the console shows. Returns null when there is
// no analysis yet (for example a call that was too short).
export function mapResult(templateId, industry, conv, dialledName = '') {
  if (templateId === 'lending') return lendingResult(conv, dialledName);
  const dc = conv?.analysis?.data_collection_results;
  if (!dc || Object.keys(dc).length === 0) return null;
  const v = (k) => str(dc[k]?.value);

  const fields = resultFields(templateId, industry)
    .map(({ key, label }) => {
      let value = v(key);
      if (key === 'caller_phone') value = value.replace(/[^\d+]/g, '');
      return { key, label, value };
    })
    .filter((f) => f.value);

  const rawOutcome = v('outcome').toLowerCase();
  const urgency = v('urgency').toLowerCase();
  return {
    kind: 'assistant',
    outcome: ASSISTANT_OUTCOMES.includes(rawOutcome) ? rawOutcome : 'info_only',
    urgency: ['emergency', 'urgent', 'normal'].includes(urgency) ? urgency : '',
    sentiment: v('sentiment'),
    notes: v('notes'),
    callerName: v('caller_name'),
    callerPhone: v('caller_phone').replace(/[^\d+]/g, ''),
    fields,
  };
}

// Call-level extras: summary, title, duration and the audit checks.
export function mapMeta(templateId, conv) {
  if (templateId === 'lending') return lendingMeta(conv);
  const a = conv?.analysis || {};
  const checks = Object.entries(a.evaluation_criteria_results || {}).map(([id, r]) => ({
    id,
    result: r?.result || 'unknown',
    rationale: str(r?.rationale),
  }));
  return {
    summary: str(a.transcript_summary),
    title: str(a.call_summary_title),
    checks,
    durationSecs: Number(conv?.metadata?.call_duration_secs) || 0,
  };
}

// --------------------------------------------------------- call room

// Same six step ids the update_progress tool reports; only the wording differs.
export function progressStepsFor(templateId, industry) {
  if (templateId === 'lending') return PROGRESS_STEPS;
  const labels = preset(industry).steps;
  return PROGRESS_STEPS.map((step, i) => ({ id: step.id, label: labels[i] || step.label }));
}

export function tryPhrases(templateId, industry, language) {
  if (templateId === 'lending') {
    return language === 'hi'
      ? ['हाँ, मैंने loan के लिए enquiry की थी', 'मुझे घर की renovation के लिए 5 लाख चाहिए', 'Interest rate कितना लगेगा?']
      : ['Yes, I enquired about a loan', 'I need five lakh for home renovation', 'What interest rate will I get?'];
  }
  const p = preset(industry);
  return language === 'hi' ? p.tryHi : p.tryEn;
}
