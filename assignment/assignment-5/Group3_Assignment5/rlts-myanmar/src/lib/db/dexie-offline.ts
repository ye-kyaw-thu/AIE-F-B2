"use client";

// Driver-side offline client engine (project_detail.md section 3.1).
//
// The Driver Mobile Client writes every action to IndexedDB first, unconditionally,
// before it ever tries the network. This is the "offline is a normal operating state,
// not an exception" principle from Logistimo / Open mSupply / OpenLMIS: the UI gets
// instant feedback and never blocks on connectivity, and the pending_sync_queue table
// is the durable record of "what the driver did" until the sync engine can drain it.

import Dexie, { type Table } from "dexie";
import type { PendingSyncRecord } from "@/lib/types";

class RltsOfflineDB extends Dexie {
  pendingSyncQueue!: Table<PendingSyncRecord, string>;

  constructor() {
    super("rlts_mm_offline");
    this.version(1).stores({
      // eventUuid is the primary key: every event is idempotent client-side too, so
      // re-submitting the same tap twice (e.g. a flaky button press) never double-queues.
      pendingSyncQueue: "eventUuid, shipmentId, status, clientRecordedAt",
    });
  }
}

export const offlineDB = new RltsOfflineDB();

/** Compress a captured photo to WebP under ~200KB, per project_detail.md 3.4. */
export async function compressImageToWebP(file: File, maxBytes = 200_000): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  let { width, height } = img;
  const MAX_DIM = 1024;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fall back to the uncompressed capture rather than fail
  ctx.drawImage(img, 0, 0, width, height);

  // Step quality down until under the byte budget, or we hit the floor.
  let quality = 0.8;
  let out = canvas.toDataURL("image/webp", quality);
  while (out.length * 0.75 > maxBytes && quality > 0.2) {
    quality -= 0.15;
    out = canvas.toDataURL("image/webp", quality);
  }
  return out;
}
