// A demo: one company's branded agent, plus the link that opens it.
//
// Pure module (validation and shaping only), shared by the console, the public
// call room and the API routes.
//
//   demo = {
//     id, createdAt, updatedAt,
//     templateId, industry,
//     business { name, website, tagline, services[], hours, location, phone, email, about, logoUrl, accent },
//     agent    { name, gender, language, voiceId },
//     cta      { url, label },
//     lending  { partnerBanks, regulatorLine }      (loan-qualifier template only)
//     notes,                                         (operator-only)
//     agentId, agentHash, agentFp,                   (set by the server once the ElevenLabs agent exists)
//   }
import { sanitiseSettings, DEFAULT_SETTINGS, ttsModelFor } from '@/lib/loan/options';
import { TEMPLATES, INDUSTRIES, DEMO_LANGUAGES, buildPrompt, openingLine, templateById, progressStepsFor, tryPhrases } from './templates';

export const DEMO_ID_RE = /^dmo_[a-z0-9]{10}$/;
export const MAX_ABOUT = 6000;

// Premade ElevenLabs voices (present on every account) used when no voice is
// chosen for an English demo. Hindi demos pick a Hindi voice from the account.
export const DEFAULT_EN_VOICES = { female: 'XrExE9yKIg1WjnnlVkGX', male: 'cjVigY5qzO86Huf0OWal' };

// The persona name used when the operator doesn't choose one.
export const DEFAULT_NAMES = {
  en: { female: 'Emma', male: 'James' },
  hi: { female: 'अदिति', male: 'अमित' },
};

// ------------------------------------------------------------ cleaning

const TAGS = /<\/?[a-z][^>]*>/gi;
const SPACE_BEFORE_PUNCT = /[ \t]+([.,;:!?])/g;

function line(v, max) {
  return String(v ?? '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(TAGS, ' ')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(SPACE_BEFORE_PUNCT, '$1')
    .trim()
    .slice(0, max);
}

// Free text from a website or the operator: keep paragraphs, drop anything the
// prompt or the page could misread (braces become dynamic variables in the
// agent prompt, angle brackets become markup).
export function cleanText(v, max = MAX_ABOUT) {
  return String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(TAGS, ' ')
    .replace(/[{}<>]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(SPACE_BEFORE_PUNCT, '$1')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function cleanUrl(v, max = 300) {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.username || u.password) return '';
    const href = u.href;
    return href.length <= max ? href : '';
  } catch {
    return '';
  }
}

function cleanList(v, maxItems, maxLen) {
  const items = Array.isArray(v) ? v : String(v ?? '').split(/[\n;|]+/);
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const s = line(item, maxLen);
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitiseBusiness(input = {}, base = {}) {
  const has = (k) => input[k] !== undefined;
  const out = { name: '', website: '', tagline: '', services: [], hours: '', location: '', phone: '', email: '', about: '', logoUrl: '', accent: '', ...base };
  if (has('name')) out.name = line(input.name, 80);
  if (has('website')) out.website = cleanUrl(input.website);
  if (has('tagline')) out.tagline = line(input.tagline, 200);
  if (has('services')) out.services = cleanList(input.services, 12, 80);
  if (has('hours')) out.hours = line(input.hours, 200);
  if (has('location')) out.location = line(input.location, 200);
  if (has('phone')) out.phone = line(input.phone, 40);
  if (has('email')) out.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email).trim()) ? line(input.email, 120) : '';
  if (has('about')) out.about = cleanText(input.about, MAX_ABOUT);
  if (has('logoUrl')) out.logoUrl = cleanUrl(input.logoUrl, 400);
  if (has('accent')) out.accent = HEX.test(String(input.accent).trim()) ? String(input.accent).trim().toLowerCase() : '';
  return out;
}

// Merge untrusted input over `base` (an existing demo, or {}). Throws an Error
// with a display-ready message when something required is missing or invalid.
export function sanitiseDemo(input = {}, base = {}) {
  const has = (k) => input[k] !== undefined;
  const templateId = has('templateId') ? String(input.templateId) : base.templateId || 'assistant';
  if (!TEMPLATES.some((t) => t.id === templateId)) throw new Error('That template does not exist.');
  const industry = has('industry') ? String(input.industry) : base.industry || 'generic';
  if (!INDUSTRIES.some((i) => i.id === industry)) throw new Error('That industry preset does not exist.');

  const business = sanitiseBusiness(input.business || {}, base.business || {});
  if (!business.name) throw new Error('Add the company name.');

  const a = input.agent || {};
  const prev = base.agent || {};
  const language = DEMO_LANGUAGES.some((l) => l.id === a.language) ? a.language : prev.language || (templateId === 'lending' ? 'hi' : 'en');
  // A lending demo is Hinglish by design.
  const finalLanguage = templateId === 'lending' ? 'hi' : language;
  const gender = a.gender === 'male' || a.gender === 'female' ? a.gender : prev.gender || 'female';
  const nameChanged = a.name !== undefined;
  const name = nameChanged ? line(a.name, 40) : prev.name || '';
  const voiceId = a.voiceId !== undefined ? (/^[A-Za-z0-9]{10,40}$/.test(String(a.voiceId).trim()) ? String(a.voiceId).trim() : '') : prev.voiceId || '';

  const c = input.cta || {};
  const pc = base.cta || {};
  const cta = {
    url: c.url !== undefined ? cleanUrl(c.url) : pc.url || '',
    label: c.label !== undefined ? line(c.label, 40) : pc.label || '',
  };

  const l = input.lending || {};
  const pl = base.lending || {};
  const lending = templateId === 'lending'
    ? {
        partnerBanks: l.partnerBanks !== undefined ? line(l.partnerBanks, 80) : pl.partnerBanks || '',
        regulatorLine: l.regulatorLine !== undefined ? line(l.regulatorLine, 80) : pl.regulatorLine ?? '',
      }
    : undefined;

  return {
    ...base,
    templateId,
    industry,
    business,
    agent: { name: name || DEFAULT_NAMES[finalLanguage][gender], gender, language: finalLanguage, voiceId },
    cta,
    ...(lending ? { lending } : {}),
    notes: has('notes') ? String(input.notes ?? '').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 300) : base.notes || '',
  };
}

// ------------------------------------------------------------ agent settings

// The settings the demo's ElevenLabs agent is built from: the operator's
// current agent settings (model, voice model, pace, call behaviour) with the
// demo's company, persona, voice and script laid over them.
export function demoSettings(demo, base = DEFAULT_SETTINGS, { voiceFallback = '' } = {}) {
  const language = demo.agent.language === 'hi' ? 'hi' : 'en';
  const tuned = base.naturalTuning !== false;
  const isAssistant = demo.templateId === 'assistant';
  const voiceId = demo.agent.voiceId || voiceFallback || (language === 'en' ? DEFAULT_EN_VOICES[demo.agent.gender] || DEFAULT_EN_VOICES.female : base.voiceId);

  return sanitiseSettings(
    {
      companyName: demo.business.name,
      agentName: demo.agent.name,
      agentGender: demo.agent.gender,
      language,
      hinglishMode: language === 'hi',
      voiceId,
      ttsModel: ttsModelFor(language, base.ttsModel),
      // Demos are short; a forgotten tab or a muted microphone shouldn't run
      // up the bill.
      maxCallMinutes: 5,
      silenceHangup: 60,
      // The assistant writes its own script and opening; the loan qualifier
      // uses the generated lending script (so any custom text on the default
      // agent must not leak in).
      prompt: isAssistant ? buildPrompt(demo, { tuned }) : '',
      firstMessage: isAssistant ? openingLine(demo) : '',
      partnerBanks: demo.lending?.partnerBanks || base.partnerBanks,
      regulatorLine: demo.lending ? demo.lending.regulatorLine : base.regulatorLine,
    },
    base
  );
}

// ------------------------------------------------------------ views

// What the public call room is allowed to know. Never the notes, the knowledge
// text, the agent id or anything else internal.
export function publicView(demo) {
  const template = templateById(demo.templateId);
  const language = demo.agent.language;
  return {
    templateId: demo.templateId,
    industry: demo.industry,
    businessName: demo.business.name,
    agentName: demo.agent.name,
    language,
    logoUrl: demo.business.logoUrl || '',
    accent: demo.business.accent || '',
    website: demo.business.website || '',
    steps: progressStepsFor(demo.templateId, demo.industry),
    tryPhrases: tryPhrases(demo.templateId, demo.industry, language),
    needsCallerName: template.needsCallerName,
    cta: demo.cta?.url ? { url: demo.cta.url, label: demo.cta.label || 'Book a call' } : null,
  };
}

// The loan qualifier's profile, as the same label/value list an assistant demo
// produces. Identity numbers (PAN) and internal flags are left out.
function lendingFields(r) {
  const rupees = (n) => (n > 0 ? `₹${Number(n).toLocaleString('en-IN')}` : '');
  const rows = [
    ['City', r.city],
    ['Loan purpose', r.purpose],
    ['Amount needed', rupees(r.amount)],
    ['Employment', r.employment_type],
    ['Monthly income', rupees(r.monthly_income)],
    ['Employer or business', r.company_or_business],
    ['Existing EMIs', r.existing_emis],
    ['Credit score', r.cibil_score],
    ['Callback time', r.callback_time],
  ];
  return rows.filter(([, value]) => value).map(([label, value]) => ({ key: label.toLowerCase().replace(/\W+/g, '_'), label, value: String(value) }));
}

// What the visitor may see of their own finished call: the lead card the
// agent captured. Never the audit checks, sentiment or internal flags.
export function publicResult(call) {
  const r = call?.result;
  if (!r) return null;
  const assistant = r.kind === 'assistant';
  return {
    outcome: r.outcome,
    urgency: assistant ? r.urgency || '' : '',
    callerName: (assistant ? r.callerName : r.name) || '',
    callerPhone: (assistant ? r.callerPhone : r.phone) || '',
    notes: r.notes || '',
    fields: assistant ? (Array.isArray(r.fields) ? r.fields.map(({ key, label, value }) => ({ key, label, value })) : []) : lendingFields(r),
    summary: call.summary || '',
    title: call.title || '',
  };
}

// Everything the console needs except the agent internals.
export function operatorView(demo) {
  const { agentHash, agentFp, ...rest } = demo;
  return { ...rest, agentReady: Boolean(demo.agentId) };
}
