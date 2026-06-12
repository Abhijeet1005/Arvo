import { promises as fs } from 'node:fs';
import path from 'node:path';

// Single-agent MVP persistence: a JSON file at the project root.
// (Multi-tenant will swap this for a real database later.)
const FILE = path.join(process.cwd(), '.agent.json');

export async function readStore() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export async function writeStore(patch) {
  const current = await readStore();
  const next = { ...current, ...patch };
  await fs.writeFile(FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

// Append an item to a list stored under `key` (e.g. messages, transfers).
export async function appendItem(key, item) {
  const current = await readStore();
  const list = Array.isArray(current[key]) ? current[key] : [];
  list.push(item);
  await writeStore({ [key]: list });
  return item;
}

export async function getAgentId() {
  // Env wins (handy on deploys); otherwise use the locally-stored id.
  if (process.env.ELEVENLABS_AGENT_ID) return process.env.ELEVENLABS_AGENT_ID;
  const s = await readStore();
  return s.agentId || null;
}
