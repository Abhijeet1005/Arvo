// What the current ElevenLabs account offers: LLMs, voices, the public voice
// library, and remaining credits. Feeds the dashboard's pickers and validates
// settings before they're synced to the agent.
import { elevenlabs } from './elevenlabs';
import { apiKeyInfo } from './settings';
import { providerOf, PROVIDER_ORDER } from './options';

// ---------------------------------------------------------------- LLMs

const LLM_TTL_MS = 10 * 60 * 1000;
const llmCache = new Map(); // key fingerprint -> { at, list }

// Models ElevenLabs can run for this account (OpenAI, Google, Anthropic, …),
// minus deprecated ones and dated snapshots.
export async function listLlms() {
  const { fingerprint } = await apiKeyInfo();
  const hit = llmCache.get(fingerprint);
  if (hit && Date.now() - hit.at < LLM_TTL_MS) return hit.list;

  const data = await elevenlabs('/v1/convai/llm/list');
  const list = (data.llms || [])
    .filter(
      (m) =>
        m.llm &&
        m.llm !== 'custom-llm' &&
        !m.deprecation_info &&
        !m.is_checkpoint &&
        m.is_approved_for_workspace !== false
    )
    .map((m, i) => ({
      id: m.llm,
      provider: providerOf(m.llm),
      efforts: Array.isArray(m.available_reasoning_efforts) ? m.available_reasoning_efforts : [],
      order: i,
    }))
    .sort((a, b) => PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider) || a.order - b.order)
    .map(({ order, ...m }) => m);

  llmCache.set(fingerprint, { at: Date.now(), list });
  return list;
}

// Check the model exists and pick a reasoning effort it supports. Reasoning
// is sent only for models that accept it (ElevenLabs rejects it otherwise);
// the lowest level is the default because it keeps replies fast on a call.
export function normaliseLlm(settings, list) {
  const model = list.find((m) => m.id === settings.llm);
  if (!model) {
    return { error: `The model “${settings.llm}” isn't available on this ElevenLabs account. Pick another one.` };
  }
  let reasoningEffort = settings.reasoningEffort;
  if (model.efforts.length === 0) reasoningEffort = '';
  else if (!model.efforts.includes(reasoningEffort)) reasoningEffort = model.efforts[0];
  return { settings: { ...settings, reasoningEffort } };
}

// -------------------------------------------------------------- voices

function titleCase(s) {
  return String(s || '').replace(/_/g, ' ').trim();
}

// Prefer a Hindi sample when the voice has one, so previews match the call.
function previewFor(v) {
  const hi = (v.verified_languages || []).find((l) => l.language === 'hi' && l.preview_url);
  return hi?.preview_url || v.preview_url || '';
}

// A voice whose *primary* language is Hindi, or that has an Indian accent.
// (Most premade voices are also verified for Hindi, so that alone says little.)
function isHindi(v, labels) {
  return (
    labels.language === 'hi' ||
    v.language === 'hi' ||
    /indian|hindi/i.test(`${labels.accent || ''} ${v.accent || ''}`)
  );
}

function mapAccountVoice(v) {
  const labels = v.labels || {};
  return {
    id: v.voice_id,
    name: v.name || v.voice_id,
    category: v.category || '',
    gender: titleCase(labels.gender),
    age: titleCase(labels.age),
    accent: titleCase(labels.accent),
    style: titleCase(labels.descriptive || labels.description),
    useCase: titleCase(labels.use_case),
    hindi: isHindi(v, labels),
    previewUrl: previewFor(v),
  };
}

// The account's own voices ("My Voices"), Hindi-capable ones first.
export async function listAccountVoices() {
  const data = await elevenlabs('/v1/voices');
  return (data.voices || [])
    .map(mapAccountVoice)
    .sort((a, b) => Number(b.hindi) - Number(a.hindi) || a.name.localeCompare(b.name));
}

// One voice from the account, or throws (voice_not_found) if it isn't there.
export async function getAccountVoice(id) {
  return mapAccountVoice(await elevenlabs(`/v1/voices/${encodeURIComponent(id)}`));
}

// Filters for the public voice library search.
export const LIBRARY_LANGUAGES = {
  hi: { label: 'Hindi', query: { language: 'hi' } },
  'en-in': { label: 'English · Indian accent', query: { language: 'en', accent: 'indian' } },
  en: { label: 'English · any accent', query: { language: 'en' } },
  all: { label: 'All languages', query: {} },
};

const PAGE_SIZE = 12;

// Search ElevenLabs' public voice library (thousands of community voices).
export async function searchLibrary({ search = '', language = 'hi', gender = '', useCase = 'conversational', page = 0 } = {}) {
  const lang = LIBRARY_LANGUAGES[language] || LIBRARY_LANGUAGES.hi;
  const data = await elevenlabs('/v1/shared-voices', {
    query: {
      page_size: PAGE_SIZE,
      page,
      sort: search ? undefined : 'trending',
      search: search.slice(0, 80),
      gender: ['male', 'female', 'neutral'].includes(gender) ? gender : undefined,
      use_cases: useCase === 'conversational' ? 'conversational' : undefined,
      ...lang.query,
    },
  });
  return {
    hasMore: Boolean(data.has_more),
    total: data.total_count ?? null,
    voices: (data.voices || []).map((v) => ({
      id: v.voice_id,
      publicOwnerId: v.public_owner_id,
      name: v.name || v.voice_id,
      gender: titleCase(v.gender),
      age: titleCase(v.age),
      accent: titleCase(v.accent),
      style: titleCase(v.descriptive),
      useCase: titleCase(v.use_case),
      description: String(v.description || '').slice(0, 160),
      previewUrl: previewFor(v),
      freeUsersAllowed: v.free_users_allowed !== false,
      added: Boolean(v.is_added_by_user),
    })),
  };
}

// Copy a library voice into the account's "My Voices" so an agent can use it.
export async function addLibraryVoice({ publicOwnerId, voiceId, name }) {
  const data = await elevenlabs(
    `/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`,
    { method: 'POST', body: { new_name: String(name || voiceId).slice(0, 100) } }
  );
  return data.voice_id || voiceId;
}

// ------------------------------------------------------------- account

// Credits used / available. Restricted keys may not be allowed to read this,
// so it's best-effort.
export async function getSubscription() {
  try {
    const s = await elevenlabs('/v1/user/subscription');
    return {
      tier: s.tier || '',
      used: Number(s.character_count) || 0,
      limit: Number(s.character_limit) || 0,
      resetsAt: s.next_character_count_reset_unix ? s.next_character_count_reset_unix * 1000 : null,
    };
  } catch {
    return null;
  }
}
