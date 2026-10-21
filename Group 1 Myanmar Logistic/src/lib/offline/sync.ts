/**
 * Sync engine: replays pending queue entries sequentially via the Supabase
 * `append_driver_update` RPC. Each entry is tried once per sync cycle.
 *
 * - Success → entry marked "synced"
 * - Network error → stays "pending" for later retry
 * - Validation/assignment conflict → marked "error" with reason for review
 * - Same UUID cannot duplicate events (backed by existing DB constraint)
 */

import { createClient } from "@/lib/supabase/client";
import {
  getQueue,
  updateQueueEntry,
  type QueueEntry,
} from "./queue";

export type SyncResult = {
  total: number;
  synced: number;
  failed: number;
  pending: number;
};

/**
 * Replay all pending entries for the given user, sequentially.
 * Returns a summary of results. Calls `onProgress` after each item.
 */
export async function syncQueue(
  userId: string,
  onProgress?: (entry: QueueEntry, result: "synced" | "error" | "pending") => void
): Promise<SyncResult> {
  const queue = getQueue(userId);
  const pending = queue.filter((e) => e.syncStatus === "pending");
  const result: SyncResult = { total: pending.length, synced: 0, failed: 0, pending: 0 };

  if (pending.length === 0) return result;

  const supabase = createClient();

  for (const entry of pending) {
    try {
      const { error } = await supabase.rpc("append_driver_update", {
        p_id: entry.id,
        p_shipment_id: entry.shipmentId,
        p_expected_updated_at: entry.revision,
        p_status: entry.status,
        p_note: entry.note,
        p_latitude: entry.latitude,
        p_longitude: entry.longitude,
        p_occurred_at: entry.occurredAt,
      });

      if (error) {
        // PT409 = stale revision (someone else updated), PT422 = invalid state
        // 22023 = validation error — these are conflicts that need review
        if (["PT409", "PT422", "22023", "42501"].includes(error.code)) {
          updateQueueEntry(userId, entry.id, {
            syncStatus: "error",
            errorMessage:
              error.code === "PT409"
                ? "This shipment changed while you were offline. Review its latest history."
                : error.code === "42501"
                  ? "You are no longer assigned to this shipment."
                  : error.message,
          });
          result.failed++;
          onProgress?.(entry, "error");
        } else {
          // Unknown DB error — keep pending for retry
          result.pending++;
          onProgress?.(entry, "pending");
        }
      } else {
        // Success — the DB accepted this update (or it was an identical retry)
        updateQueueEntry(userId, entry.id, { syncStatus: "synced", errorMessage: undefined });
        result.synced++;
        onProgress?.(entry, "synced");
      }
    } catch {
      // Network failure — keep pending for later retry
      result.pending++;
      onProgress?.(entry, "pending");
    }
  }

  return result;
}
