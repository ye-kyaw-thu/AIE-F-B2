import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Minimal localStorage stub for Node.js tests
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (index) => [...storage.keys()][index] ?? null,
};

// ---- Inline queue logic (mirrors src/lib/offline/queue.ts) ----
const QUEUE_VERSION = "v1";
function queueKey(userId) { return `logistics:queue:${QUEUE_VERSION}:${userId}`; }

function getQueue(userId) {
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.userId === userId);
  } catch { return []; }
}

function addToQueue(entry) {
  const queue = getQueue(entry.userId);
  const existing = queue.findIndex((e) => e.id === entry.id);
  if (existing >= 0) queue[existing] = entry;
  else queue.push(entry);
  localStorage.setItem(queueKey(entry.userId), JSON.stringify(queue));
}

function updateQueueEntry(userId, entryId, updates) {
  const queue = getQueue(userId);
  const index = queue.findIndex((e) => e.id === entryId);
  if (index >= 0) {
    queue[index] = { ...queue[index], ...updates };
    localStorage.setItem(queueKey(userId), JSON.stringify(queue));
  }
}

function removeFromQueue(userId, entryId) {
  const queue = getQueue(userId).filter((e) => e.id !== entryId);
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

function clearSynced(userId) {
  const queue = getQueue(userId).filter((e) => e.syncStatus !== "synced");
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

function clearQueue(userId) {
  localStorage.removeItem(queueKey(userId));
}

function pendingCount(userId) {
  return getQueue(userId).filter((e) => e.syncStatus === "pending").length;
}
// ---- End queue logic ----

before(() => storage.clear());
after(() => storage.clear());

const userA = randomUUID();
const userB = randomUUID();

function makeEntry(userId, overrides = {}) {
  return {
    id: randomUUID(),
    userId,
    shipmentId: randomUUID(),
    shipmentNumber: "MMT-TEST01",
    status: "picked_up",
    note: "Test update",
    latitude: 16.8409,
    longitude: 96.1735,
    occurredAt: new Date().toISOString(),
    revision: new Date().toISOString(),
    syncStatus: "pending",
    queuedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("empty queue returns an empty array", () => {
  assert.deepEqual(getQueue(userA), []);
  assert.equal(pendingCount(userA), 0);
});

test("addToQueue stores an entry and getQueue retrieves it", () => {
  const entry = makeEntry(userA);
  addToQueue(entry);
  const queue = getQueue(userA);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, entry.id);
  assert.equal(queue[0].syncStatus, "pending");
  assert.equal(pendingCount(userA), 1);
});

test("account isolation: userB cannot see userA entries", () => {
  assert.equal(getQueue(userB).length, 0);
  const entryB = makeEntry(userB);
  addToQueue(entryB);
  assert.equal(getQueue(userB).length, 1);
  assert.equal(getQueue(userA).length, 1);
});

test("duplicate UUID replaces the existing entry", () => {
  const entry = makeEntry(userA, { note: "Original" });
  addToQueue(entry);
  const before = getQueue(userA).length;
  addToQueue({ ...entry, note: "Updated" });
  const after = getQueue(userA);
  assert.equal(after.length, before);
  assert.equal(after.find(e => e.id === entry.id).note, "Updated");
});

test("updateQueueEntry changes syncStatus and errorMessage", () => {
  const entry = makeEntry(userA);
  addToQueue(entry);
  updateQueueEntry(userA, entry.id, { syncStatus: "synced" });
  assert.equal(getQueue(userA).find(e => e.id === entry.id).syncStatus, "synced");
  updateQueueEntry(userA, entry.id, { syncStatus: "error", errorMessage: "Conflict" });
  const updated = getQueue(userA).find(e => e.id === entry.id);
  assert.equal(updated.syncStatus, "error");
  assert.equal(updated.errorMessage, "Conflict");
});

test("removeFromQueue deletes only the specified entry", () => {
  storage.clear();
  const e1 = makeEntry(userA);
  const e2 = makeEntry(userA);
  addToQueue(e1);
  addToQueue(e2);
  assert.equal(getQueue(userA).length, 2);
  removeFromQueue(userA, e1.id);
  const remaining = getQueue(userA);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, e2.id);
});

test("clearSynced removes only synced entries", () => {
  storage.clear();
  const pending1 = makeEntry(userA, { syncStatus: "pending" });
  const synced1 = makeEntry(userA, { syncStatus: "synced" });
  const error1 = makeEntry(userA, { syncStatus: "error", errorMessage: "Bad" });
  addToQueue(pending1);
  addToQueue(synced1);
  addToQueue(error1);
  clearSynced(userA);
  const remaining = getQueue(userA);
  assert.equal(remaining.length, 2);
  assert.ok(remaining.some(e => e.id === pending1.id));
  assert.ok(remaining.some(e => e.id === error1.id));
  assert.ok(!remaining.some(e => e.id === synced1.id));
});

test("clearQueue removes all entries for the user", () => {
  storage.clear();
  addToQueue(makeEntry(userA));
  addToQueue(makeEntry(userA));
  addToQueue(makeEntry(userB));
  clearQueue(userA);
  assert.equal(getQueue(userA).length, 0);
  assert.equal(getQueue(userB).length, 1);
});

test("pendingCount counts only pending entries", () => {
  storage.clear();
  addToQueue(makeEntry(userA, { syncStatus: "pending" }));
  addToQueue(makeEntry(userA, { syncStatus: "synced" }));
  addToQueue(makeEntry(userA, { syncStatus: "pending" }));
  assert.equal(pendingCount(userA), 2);
});

test("corrupted localStorage returns empty array", () => {
  const key = `logistics:queue:v1:${userA}`;
  storage.clear();
  localStorage.setItem(key, "not valid json {{{");
  assert.deepEqual(getQueue(userA), []);
  localStorage.setItem(key, '"a string"');
  assert.deepEqual(getQueue(userA), []);
});

test("entries from a different user in the same storage key are filtered out", () => {
  storage.clear();
  const key = `logistics:queue:v1:${userA}`;
  const badEntry = makeEntry(userB);
  localStorage.setItem(key, JSON.stringify([badEntry]));
  assert.equal(getQueue(userA).length, 0);
});
