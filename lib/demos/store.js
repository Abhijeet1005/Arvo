// Demos, stored under `demos` in .agent.json (newest first).
//
// Storage only: validation lives in ./model.js and the ElevenLabs side in
// ./agent.js. Every change goes through updateStore, so two requests can't
// overwrite each other.
import crypto from 'node:crypto';
import { readStore, updateStore } from '@/lib/store';
import { DEMO_ID_RE, sanitiseDemo } from './model';

const KEY = 'demos';
export const MAX_DEMOS = 500;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function newId() {
  let id = 'dmo_';
  for (const byte of crypto.randomBytes(10)) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

export async function listDemos() {
  const store = await readStore();
  return Array.isArray(store[KEY]) ? store[KEY] : [];
}

export async function getDemo(id) {
  if (!DEMO_ID_RE.test(String(id ?? ''))) return null;
  return (await listDemos()).find((d) => d.id === id) || null;
}

// Throws an Error with a display-ready message when the input is invalid or
// the limit is reached.
export async function createDemo(input) {
  let demo;
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? store[KEY] : [];
    if (list.length >= MAX_DEMOS) throw new Error(`You have reached the limit of ${MAX_DEMOS} demos. Delete some you no longer need.`);
    const now = new Date().toISOString();
    let id = newId();
    while (list.some((d) => d.id === id)) id = newId();
    demo = { ...sanitiseDemo(input), id, createdAt: now, updatedAt: now };
    return { ...store, [KEY]: [demo, ...list] };
  });
  return demo;
}

// Apply an operator edit (validated against the stored demo). Returns the new
// demo, or null if it no longer exists.
export async function editDemo(id, input) {
  if (!DEMO_ID_RE.test(String(id ?? ''))) return null;
  let demo = null;
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? [...store[KEY]] : [];
    const i = list.findIndex((d) => d.id === id);
    if (i === -1) return;
    demo = { ...sanitiseDemo(input, list[i]), id, updatedAt: new Date().toISOString() };
    list[i] = demo;
    return { ...store, [KEY]: list };
  });
  return demo;
}

// Server-side bookkeeping (agent id, hash, ...). Not for operator input.
export async function patchDemo(id, patch) {
  if (!DEMO_ID_RE.test(String(id ?? ''))) return null;
  let demo = null;
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? [...store[KEY]] : [];
    const i = list.findIndex((d) => d.id === id);
    if (i === -1) return;
    demo = { ...list[i], ...patch };
    list[i] = demo;
    return { ...store, [KEY]: list };
  });
  return demo;
}

// Returns the removed demo (so the caller can clean up its agent), or null.
export async function deleteDemo(id) {
  if (!DEMO_ID_RE.test(String(id ?? ''))) return null;
  let removed = null;
  await updateStore((store) => {
    const list = Array.isArray(store[KEY]) ? store[KEY] : [];
    removed = list.find((d) => d.id === id) || null;
    if (!removed) return;
    return { ...store, [KEY]: list.filter((d) => d.id !== id) };
  });
  return removed;
}
