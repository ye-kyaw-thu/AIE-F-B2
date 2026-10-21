"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, CheckCheck, MapPin, RefreshCw, TriangleAlert } from "lucide-react";
import { useAppStore } from "@/lib/store/appStore";
import { useAuthStore } from "@/lib/auth/authStore";
import RequireRole, { UserBadge } from "@/components/RequireRole";
import { offlineDB, compressImageToWebP } from "@/lib/db/dexie-offline";
import { buildFallbackSms, flushQueue, queueCheckpointEvent } from "@/lib/sync/sync-engine";
import { NORTHERN_CORRIDOR, EASTERN_CORRIDOR, nextWaypoint, positionAlongRoute, routeTotalKm } from "@/lib/geo/myanmar-routes";
import { useRealNetworkState } from "@/lib/net/useRealNetworkState";
import { formatCurrency } from "@/lib/currency";
import { useT } from "@/lib/i18n/useT";
import NetworkSimulator from "@/components/NetworkSimulator";
import OfflineQueueBadge from "@/components/OfflineQueueBadge";
import type { NetworkState, TelemetryEventType } from "@/lib/types";

export default function DriverPage() {
  return (
    <RequireRole role="truck_driver">
      <DriverConsole />
    </RequireRole>
  );
}

function DriverConsole() {
  const t = useT();
  const session = useAuthStore((s) => s.session);
  const shipments = useAppStore((s) => s.shipments);
  // Scoped to this driver's own account — with the data-entry-clerk workflow, there can
  // now be several shipments in the system; a driver only ever sees the one(s) assigned
  // to them, not everyone's cargo.
  const myShipments = shipments.filter((s) => s.driverUsername === session?.username);
  const shipment = myShipments.find((s) => s.currentStatus !== "DELIVERED") ?? myShipments[0];
  const route = shipment?.destinationName.includes("Muse") ? NORTHERN_CORRIDOR : EASTERN_CORRIDOR;

  // Real device connectivity (navigator.onLine + Network Information API) — see
  // useRealNetworkState.ts. A manual override lets the demo force a state on cue; when
  // not overridden, the app reacts to the device's/emulator's actual network condition.
  const realNetworkState = useRealNetworkState();
  const [manualOverride, setManualOverride] = useState<NetworkState | null>(null);
  const networkState = manualOverride ?? realNetworkState;
  const [notes, setNotes] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);
  const [lastSyncRef, setLastSyncRef] = useState<string | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  // Confirming delivery in-app rather than via window.confirm(): a native browser
  // dialog is a bad fit for a "finalize this shipment" action on mobile Chrome —
  // Chrome silently suppresses window.confirm() after a page has already triggered
  // several JS dialogs in the same session (exactly what happens here, since the
  // password-manager prompts count toward that same limit), so the confirmation could
  // just never appear and the tap would silently no-op.
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  const queueItems = useLiveQuery(() => offlineDB.pendingSyncQueue.orderBy("clientRecordedAt").reverse().toArray(), []);
  const pendingCount = queueItems?.filter((q) => q.status === "QUEUED_LOCALLY").length ?? 0;

  const next = shipment ? nextWaypoint(route, shipment.routeProgress) : null;
  const truckPos = shipment ? positionAlongRoute(route, shipment.routeProgress) : { lat: 0, lng: 0 };

  // Auto-drain the queue whenever connectivity is (re)established — this is the
  // "connection detected -> initiate batch delta sync" step from project_detail.md 3.2.
  useEffect(() => {
    if (networkState !== "OFFLINE") {
      flushQueue(networkState).then((r) => {
        if (r.lastSyncRef) setLastSyncRef(r.lastSyncRef);
      });
    }
  }, [networkState]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToWebP(file);
    setPhotoDataUrl(compressed);
  }

  async function handleAction(eventType: TelemetryEventType, checkpointName: string, label: string) {
    if (!shipment) return;
    await queueCheckpointEvent({
      shipmentId: shipment.id,
      checkpointName,
      eventType,
      notes: notes || null,
      photoDataUrl,
      lat: truckPos.lat,
      lng: truckPos.lng,
    });
    setLastAction(`${label} queued at ${new Date().toLocaleTimeString()}`);
    setNotes("");
    setPhotoDataUrl(null);
    setConfirmingDelivery(false);
    if (networkState !== "OFFLINE") {
      const r = await flushQueue(networkState);
      if (r.lastSyncRef) setLastSyncRef(r.lastSyncRef);
    }
  }

  async function handleSyncNow() {
    if (networkState === "OFFLINE") return;
    setSyncingNow(true);
    try {
      const r = await flushQueue(networkState);
      if (r.lastSyncRef) setLastSyncRef(r.lastSyncRef);
    } finally {
      setSyncingNow(false);
    }
  }

  const lastQueued = queueItems?.[0];

  return (
    <main className="mx-auto max-w-[420px] px-3 py-5">
      <Link href="/" className="text-xs text-slate-400 hover:underline">
        ← {t("roleSelector")}
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">{t("driverTitle")}</h1>
        <UserBadge />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <OfflineQueueBadge pendingCount={pendingCount} />
        <button
          onClick={handleSyncNow}
          disabled={networkState === "OFFLINE" || syncingNow}
          className="flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${syncingNow ? "animate-spin" : ""}`} />
          {t("syncNow")}
        </button>
      </div>
      {lastSyncRef && (
        <p className="mt-1 text-right text-[10px] text-slate-400">
          {t("syncRef")}: <span className="font-mono text-slate-500">{lastSyncRef}</span>
        </p>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-slate-400">{t("networkStatus")}</p>
          <p className="text-[11px] text-slate-400">
            {t("deviceReports")}: <span className="font-semibold text-slate-600">{realNetworkState}</span>
          </p>
        </div>
        <NetworkSimulator value={networkState} onChange={setManualOverride} />
        {manualOverride && manualOverride !== realNetworkState && (
          <button
            onClick={() => setManualOverride(null)}
            className="mt-1.5 text-[11px] text-sky-600 underline underline-offset-2"
          >
            Override active — click to go back to the device&apos;s real network state ({realNetworkState})
          </button>
        )}
      </div>

      {!shipment && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-400">
          {t("noShipmentAssigned")}
        </div>
      )}

      {shipment && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="font-mono text-sm font-semibold">{shipment.trackingNumber}</p>
          <p className="text-xs text-slate-500">
            {shipment.originName.split(" ")[0]} → {shipment.destinationName.split(" ")[0]}
          </p>
          <p className="text-xs text-slate-500">{shipment.cargoType}</p>
          <p className="text-xs text-slate-500">
            {t("cargoValue")}: {formatCurrency(shipment.cargoValue, shipment.cargoValueCurrency)}
          </p>
          {next && (
            <p className="mt-2 flex items-center gap-1.5 rounded bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800">
              <MapPin className="h-3.5 w-3.5" />
              Next: {next.name} — {Math.max(0, Math.round(next.distanceFromOriginKm - shipment.routeProgress * routeTotalKm(route)))} km
            </p>
          )}
        </div>
      )}

      {shipment && (
        <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div>
            <span className="font-mono text-slate-700">
              {truckPos.lat.toFixed(4)}, {truckPos.lng.toFixed(4)}
            </span>{" "}
            <span className="text-slate-400">
              — simulated position from route progress (
              {Math.round(shipment.routeProgress * 100)}% along the corridor), not the device&apos;s real GPS. This
              is what gets recorded on the next checkpoint action below.
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">{t("checkpointActions")}</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note"
          rows={2}
          className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 py-2 text-xs text-slate-500 hover:bg-slate-50">
          <Camera className="h-4 w-4" />
          {photoDataUrl ? t("photoAttached") : t("capturePhoto")}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} disabled={!shipment} />
        </label>

        <div className="grid gap-2">
          <button
            onClick={() => handleAction("ARRIVED", next?.name ?? "Checkpoint", "Arrived at Checkpoint")}
            disabled={!shipment}
            className="rounded-lg bg-sky-600 py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            {t("arrived")}
          </button>
          <button
            onClick={() => handleAction("CLEARED", next?.name ?? "Checkpoint", "Inspection Passed")}
            disabled={!shipment}
            className="rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            {t("cleared")}
          </button>
          <button
            onClick={() => handleAction("DELAY_REPORTED", next?.name ?? "Checkpoint", "Report Delay / Danger")}
            disabled={!shipment}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            <TriangleAlert className="h-4 w-4" />
            {t("delay")}
          </button>

          {!confirmingDelivery ? (
            <button
              onClick={() => setConfirmingDelivery(true)}
              disabled={!shipment}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              {t("delivered")}
            </button>
          ) : (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2.5">
              <p className="mb-2 text-center text-xs font-medium text-slate-700">
                Mark {shipment?.trackingNumber} as delivered? This finalizes the shipment.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelivery(false)}
                  className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleAction("DELIVERED", next?.name ?? shipment?.destinationName ?? "Destination", "Delivered / Handed Over")
                  }
                  className="flex-1 rounded-md bg-slate-900 py-2 text-xs font-semibold text-white"
                >
                  Confirm delivery
                </button>
              </div>
            </div>
          )}
        </div>

        {lastAction && <p className="mt-2 text-center text-xs text-slate-400">{lastAction}</p>}
      </div>

      {networkState === "OFFLINE" && lastQueued && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="mb-1 text-xs font-semibold text-red-800">
            Extreme blackout fallback (project_detail.md §3.5): send this as a plain SMS instead
          </p>
          <button
            onClick={() => setSmsPreview(buildFallbackSms(lastQueued))}
            className="mb-2 w-full rounded-md border border-red-300 bg-white py-1.5 text-xs font-semibold text-red-700"
          >
            Generate structured SMS payload
          </button>
          {smsPreview && (
            <code className="block break-all rounded bg-white p-2 text-[11px] text-red-900">{smsPreview}</code>
          )}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">{t("localQueue")}</p>
        {!queueItems || queueItems.length === 0 ? (
          <p className="text-xs text-slate-400">{t("nothingQueued")}</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {queueItems.slice(0, 6).map((q) => (
              <li key={q.eventUuid} className="flex items-center justify-between">
                <span>
                  {q.checkpointName} · {q.eventType}{" "}
                  <span className="font-mono text-[10px] text-slate-300">Ref: {q.eventUuid.slice(0, 8)}</span>
                </span>
                <span className={q.status === "SYNCED" ? "text-emerald-600" : "text-amber-600"}>{q.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
