import { promises as fs } from 'node:fs';
import path from 'node:path';

// Single-agent MVP persistence: a JSON file at the project root.
// (Multi-tenant will swap this for a real database later.)
const FILE = path.join(process.cwd(), '.agent.json');

// Every change goes through updateStore(), which holds this lock for the whole
// read-modify-write. One Node process serves the app, so a promise chain is
// enough. Without it, two requests that each read the file, change a different
// part and write it back would silently undo each other (a call being
// registered while a settings save lands, for example). The chain lives on
// globalThis so every route bundle shares it.
const g = globalThis;
g.__arvoStoreChain ||= Promise.resolve();

function exclusive(task) {
  const run = g.__arvoStoreChain.then(task, task);
  g.__arvoStoreChain = run.then(() => undefined, () => undefined);
  return run;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reading retries briefly: on Windows the file can be momentarily invisible
// while another write replaces it. Returning {} for a blip would be harmful,
// because the next save would write that empty store back over real data.
async function readRaw() {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return JSON.parse(await fs.readFile(FILE, 'utf8'));
    } catch (e) {
      lastError = e;
      if (e.code === 'ENOENT' && attempt >= 1) break; // really absent: a first run
      await sleep(10 * (attempt + 1));
    }
  }
  if (lastError && lastError.code !== 'ENOENT') {
    // The file exists but won't parse. Keep a copy before it gets replaced.
    try {
      const target = await fs.realpath(FILE).catch(() => FILE);
      await fs.copyFile(target, `${target}.corrupt-${Date.now()}`);
      console.error('[store] .agent.json was unreadable; a copy was kept next to it.');
    } catch {
      // Nothing more to do.
    }
  }
  return {};
}

// The file can be a symlink into a data directory (the server keeps its data
// outside the read-only release folder), so write next to the real file, then
// rename into place. A crash or power cut mid-write then leaves the previous
// version intact instead of a half-written file that reads back as empty.
async function writeRaw(data) {
  const target = await fs.realpath(FILE).catch(() => FILE);
  const tmp = `${target}.${process.pid}.tmp`;
  const text = JSON.stringify(data, null, 2);
  try {
    await fs.writeFile(tmp, text, { encoding: 'utf8', mode: 0o600 });
    try {
      await fs.rename(tmp, target);
    } catch (e) {
      // Windows can refuse to replace a file another program has open; a plain
      // write still works there.
      if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
      await fs.writeFile(target, text, 'utf8');
      await fs.rm(tmp, { force: true }).catch(() => {});
    }
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

export async function readStore() {
  // Reads need no lock: a write replaces the file in one atomic rename.
  return readRaw();
}

// Atomic read-modify-write. `mutator` receives the current store and returns
// the new one (or nothing to keep it as is). Don't call updateStore from
// inside a mutator.
export function updateStore(mutator) {
  return exclusive(async () => {
    const current = await readRaw();
    const next = (await mutator(current)) ?? current;
    await writeRaw(next);
    return next;
  });
}

export function writeStore(patch) {
  return updateStore((current) => ({ ...current, ...patch }));
}

// Append an item to a list stored under `key` (e.g. messages, transfers).
export async function appendItem(key, item) {
  await updateStore((current) => ({
    ...current,
    [key]: [...(Array.isArray(current[key]) ? current[key] : []), item],
  }));
  return item;
}

export async function getAgentId() {
  // Env wins (handy on deploys); otherwise use the locally-stored id.
  if (process.env.ELEVENLABS_AGENT_ID) return process.env.ELEVENLABS_AGENT_ID;
  const s = await readStore();
  return s.agentId || null;
}
