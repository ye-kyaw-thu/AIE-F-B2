"use client";

// Client for the real RLTS-MM backend (src/app/api/*, src/lib/server/db.ts).
//
// This used to be a browser-only backend (localStorage + BroadcastChannel) so
// Admin/Trader/Driver tabs of one browser could share state with no server at all. That
// stopped being enough the moment a native Flutter driver app entered the picture — a
// separate OS process has no access to a browser's storage, so "synced to driver and
// trader and web portal" now requires an actual server both sides can reach. This store
// keeps the same public shape (so the pages barely changed) but every mutation is now a
// real HTTP call, and a short poll keeps each open tab's view fresh.
//
// Poll interval is a deliberate simplicity trade-off over WebSockets/SSE: 2 seconds is
// fast enough to feel live in a demo, and a plain setInterval+fetch has far fewer ways
// to fail silently than a persistent connection would, which matters more than
// millisecond latency for a presentation that has to work on the day.

import { create } from "zustand";
import type { CloudState, EmergencyBroadcast, GateStatus, TelemetryEvent } from "@/lib/types";

const POLL_MS = 2000;

const EMPTY_STATE: CloudState = { rev: 0, gates: [], shipments: [], telemetry: [], broadcasts: [] };

export interface CreateShipmentInput {
  driverUsername: string;
  traderUsername: string;
  cargoType: string;
  cargoWeightTons: number;
  cargoValue: number;
  cargoValueCurrency: string;
  targetGateId: string;
  estimatedArrival?: string;
  trackingNumber?: string;
  createdBy: string;
}

/** All fields optional — only the ones present get changed, matching PATCH semantics. */
export type UpdateShipmentInput = Partial<Omit<CreateShipmentInput, "createdBy">>;

interface AppStore extends CloudState {
  hydrated: boolean;
  syncing: boolean;
  lastError: string | null;
  hydrate: () => void;
  refresh: () => Promise<void>;
  toggleGate: (gateId: string, status: GateStatus, reason: string | null, updatedBy: string) => Promise<void>;
  createBroadcast: (b: Pick<EmergencyBroadcast, "title" | "message" | "severity" | "gateId" | "routeAffected">) => Promise<void>;
  dismissBroadcast: (id: string) => Promise<void>;
  createShipment: (input: CreateShipmentInput) => Promise<{ ok: boolean; error?: string }>;
  updateShipment: (id: string, input: UpdateShipmentInput) => Promise<{ ok: boolean; error?: string }>;
  deleteShipment: (id: string) => Promise<{ ok: boolean; error?: string }>;
  getTimelineForShipment: (shipmentId: string) => TelemetryEvent[];
  resetDemo: () => Promise<void>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const useAppStore = create<AppStore>((set, get) => {
  async function refresh() {
    try {
      const state = await apiFetch<CloudState>("/api/state");
      set({ ...state, lastError: null });
    } catch (err) {
      // Keep the last-known state on screen rather than blanking it — a transient
      // failed poll (e.g. real device connectivity drop) shouldn't nuke the UI.
      set({ lastError: err instanceof Error ? err.message : "Failed to reach the server." });
    }
  }

  return {
    ...EMPTY_STATE,
    hydrated: false,
    syncing: false,
    lastError: null,

    hydrate: () => {
      if (get().hydrated) return;
      set({ hydrated: true });
      refresh();
      if (typeof window !== "undefined" && !pollTimer) {
        pollTimer = setInterval(refresh, POLL_MS);
      }
    },

    refresh,

    toggleGate: async (gateId, status, reason, updatedBy) => {
      set({ syncing: true });
      try {
        await apiFetch(`/api/gates/${gateId}`, { method: "PATCH", body: JSON.stringify({ status, reason, updatedBy }) });
        await refresh();
      } finally {
        set({ syncing: false });
      }
    },

    createBroadcast: async (b) => {
      set({ syncing: true });
      try {
        await apiFetch("/api/broadcasts", { method: "POST", body: JSON.stringify(b) });
        await refresh();
      } finally {
        set({ syncing: false });
      }
    },

    dismissBroadcast: async (id) => {
      await apiFetch(`/api/broadcasts/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
      await refresh();
    },

    createShipment: async (input) => {
      try {
        await apiFetch("/api/shipments", { method: "POST", body: JSON.stringify(input) });
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to create shipment." };
      }
    },

    updateShipment: async (id, input) => {
      try {
        await apiFetch(`/api/shipments/${id}`, { method: "PATCH", body: JSON.stringify(input) });
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to update shipment." };
      }
    },

    deleteShipment: async (id) => {
      try {
        await apiFetch(`/api/shipments/${id}`, { method: "DELETE" });
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to delete shipment." };
      }
    },

    getTimelineForShipment: (shipmentId) => {
      return get()
        .telemetry.filter((t) => t.shipmentId === shipmentId)
        .sort((a, b) => new Date(a.clientRecordedAt).getTime() - new Date(b.clientRecordedAt).getTime());
    },

    resetDemo: async () => {
      await apiFetch("/api/reset", { method: "POST" });
      await refresh();
    },
  };
});
