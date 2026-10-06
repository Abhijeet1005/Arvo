// Loan-advisor state, stored under `loan` in .agent.json (gitignored):
//   settings  — everything the dashboard can configure (see ./options.js)
//   apiKey    — optional ElevenLabs key set from the dashboard (wins over .env.local)
//   agents    — the ElevenLabs agent synced for each account, keyed by a
//               fingerprint of the API key, so rotating between test keys
//               reuses each account's agent instead of creating new ones.
import crypto from 'node:crypto';
import { readStore, writeStore } from '@/lib/store';
import { DEFAULT_SETTINGS, DEFAULT_VOICE_ID, sanitiseSettings } from './options';

export { DEFAULT_SETTINGS, sanitiseSettings };

// Defaults, with the voice taken from .env.local when set there.
export function defaultSettings() {
  return { ...DEFAULT_SETTINGS, voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID };
}

export function fingerprint(key) {
  return key ? crypto.createHash('sha256').update(key).digest('hex').slice(0, 16) : '';
}

function lastFour(key) {
  return key ? key.slice(-4) : '';
}

async function readLoan() {
  const store = await readStore();
  return store.loan || {};
}

async function writeLoan(patch) {
  const loan = await readLoan();
  const next = { ...loan, ...patch };
  await writeStore({ loan: next });
  return next;
}

// The ElevenLabs key in use: the dashboard one if set, else .env.local.
export async function apiKeyInfo() {
  const loan = await readLoan();
  const dashboardKey = typeof loan.apiKey === 'string' ? loan.apiKey : '';
  const envKey = process.env.ELEVENLABS_API_KEY || '';
  const key = dashboardKey || envKey;
  return {
    key,
    source: dashboardKey ? 'dashboard' : envKey ? 'env' : null,
    last4: lastFour(key),
    fingerprint: fingerprint(key),
    envAvailable: Boolean(envKey),
  };
}

// Public view of the key (never the key itself).
export async function keyStatus() {
  const { source, last4, envAvailable } = await apiKeyInfo();
  return { configured: Boolean(source), source, last4, envAvailable };
}

export async function setDashboardApiKey(key) {
  await writeLoan({ apiKey: key });
}

export async function clearDashboardApiKey() {
  const loan = await readLoan();
  delete loan.apiKey;
  await writeStore({ loan });
}

export async function getSettings() {
  const loan = await readLoan();
  return sanitiseSettings(loan.settings || {}, defaultSettings());
}

export async function saveSettings(settings) {
  await writeLoan({ settings });
  return settings;
}

// The agent synced for the current account: { agentId, agentHash } or {}.
export async function getAccountAgent(fp) {
  const loan = await readLoan();
  const agents = { ...(loan.agents || {}) };
  // One-time migration: before per-account tracking, the single agent was
  // always created with the .env.local key.
  if (loan.agentId && Object.keys(agents).length === 0 && process.env.ELEVENLABS_API_KEY) {
    agents[fingerprint(process.env.ELEVENLABS_API_KEY)] = { agentId: loan.agentId, agentHash: loan.agentHash || '' };
    const { agentId, agentHash, ...rest } = loan;
    await writeStore({ loan: { ...rest, agents } });
  }
  return agents[fp] || {};
}

export async function saveAccountAgent(fp, value) {
  const loan = await readLoan();
  const agents = { ...(loan.agents || {}) };
  if (value) agents[fp] = value;
  else delete agents[fp];
  await writeLoan({ agents });
}
