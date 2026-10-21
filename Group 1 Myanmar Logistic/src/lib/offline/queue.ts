/**
 * Offline queue for Driver shipment updates.
 * Stores pending updates in localStorage under a user-scoped versioned key.
 * Queue entries use stable UUIDs for safe retry and are never submitted
 * under a different signed-in identity.
 */

import type { ShipmentStatus } from "@/types/domain";

const QUEUE_VERSION = "v1";
function queueKey(userId: string) { return `logistics:queue:${QUEUE_VERSION}:${userId}`; }

export interface QueueEntry {
  /** Client-generated stable UUID — reused on retry. */
  id: string;
  /** The authenticated driver who created this entry. */
  userId: string;
  shipmentId: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  note: string;
  latitude: number | null;
  longitude: number | null;
  /** ISO datetime when the driver captured the update. */
  occurredAt: string;
  /** Expected shipment revision at time of capture. */
  revision: string;
  /** Current sync state. */
  syncStatus: "pending" | "synced" | "error";
  /** Error message from the last sync attempt, if any. */
  errorMessage?: string;
  /** When this entry was added to the queue. */
  queuedAt: string;
}

/** Read the queue for the given user. Returns [] if empty or unparseable. */
export function getQueue(userId: string): QueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry: QueueEntry) => entry && entry.userId === userId
    );
  } catch {
    return [];
  }
}

/** Add a new entry to the queue. */
export function addToQueue(entry: QueueEntry): void {
  const queue = getQueue(entry.userId);
  // Prevent duplicate UUIDs — if same ID exists, replace it
  const existing = queue.findIndex((e) => e.id === entry.id);
  if (existing >= 0) queue[existing] = entry;
  else queue.push(entry);
  localStorage.setItem(queueKey(entry.userId), JSON.stringify(queue));
}

/** Update an existing entry in the queue (e.g. mark as synced or error). */
export function updateQueueEntry(
  userId: string,
  entryId: string,
  updates: Partial<Pick<QueueEntry, "syncStatus" | "errorMessage">>
): void {
  const queue = getQueue(userId);
  const index = queue.findIndex((e) => e.id === entryId);
  if (index >= 0) {
    queue[index] = { ...queue[index], ...updates };
    localStorage.setItem(queueKey(userId), JSON.stringify(queue));
  }
}

/** Remove a single entry from the queue. */
export function removeFromQueue(userId: string, entryId: string): void {
  const queue = getQueue(userId).filter((e) => e.id !== entryId);
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

/** Remove all synced entries from the queue. */
export function clearSynced(userId: string): void {
  const queue = getQueue(userId).filter((e) => e.syncStatus !== "synced");
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

/** Remove all entries from the queue for this user. */
export function clearQueue(userId: string): void {
  localStorage.removeItem(queueKey(userId));
}

/** Count pending (unsynced) entries. */
export function pendingCount(userId: string): number {
  return getQueue(userId).filter((e) => e.syncStatus === "pending").length;
}
