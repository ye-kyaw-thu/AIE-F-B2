"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/appStore";
import { useAuthStore } from "@/lib/auth/authStore";
import RequireRole, { UserBadge } from "@/components/RequireRole";
import MilestoneStepper from "@/components/MilestoneStepper";
import MapView from "@/components/MapView";
import AlertBanner from "@/components/AlertBanner";
import { NORTHERN_CORRIDOR, EASTERN_CORRIDOR } from "@/lib/geo/myanmar-routes";
import { formatCurrency } from "@/lib/currency";
import { useT } from "@/lib/i18n/useT";
import { computeTraderKpis } from "@/lib/kpis";
import KpiCard from "@/components/KpiCard";
import { AlertTriangle, Truck, Wallet } from "lucide-react";

export default function TraderPage() {
  return (
    <RequireRole role="cargo_trader">
      <TraderPortal />
    </RequireRole>
  );
}

function TraderPortal() {
  const t = useT();
  const session = useAuthStore((s) => s.session);
  const allShipments = useAppStore((s) => s.shipments);
  const gates = useAppStore((s) => s.gates);
  const broadcasts = useAppStore((s) => s.broadcasts);
  const dismissBroadcast = useAppStore((s) => s.dismissBroadcast);
  const getTimelineForShipment = useAppStore((s) => s.getTimelineForShipment);

  // Scoped to this trader's own cargo — one account shouldn't see another trader's
  // shipments, now that the clerk workflow can create shipments for multiple traders.
  const shipments = allShipments.filter((s) => s.traderUsername === session?.username);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(shipments[0]?.id ?? "");

  const filtered = useMemo(
    () => shipments.filter((s) => s.trackingNumber.toLowerCase().includes(query.toLowerCase())),
    [shipments, query]
  );
  const shipment = shipments.find((s) => s.id === selectedId) ?? filtered[0];
  const targetGate = gates.find((g) => g.id === shipment?.targetGateId);
  const route = shipment?.destinationName.includes("Muse") ? NORTHERN_CORRIDOR : EASTERN_CORRIDOR;
  const timeline = shipment ? getTimelineForShipment(shipment.id) : [];

  const relevantBroadcasts = broadcasts.filter((b) => !targetGate || b.gateId === targetGate.id || b.gateId === null);
  const kpis = computeTraderKpis(shipments);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between">
        <Link href="/" className="text-xs text-slate-400 hover:underline">
          ← {t("roleSelector")}
        </Link>
        <UserBadge />
      </div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">{t("traderTitle")}</h1>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <KpiCard label={t("kpiActiveShipments")} value={kpis.activeShipments} icon={Truck} />
        <KpiCard label={t("kpiDelayed")} value={kpis.delayed} icon={AlertTriangle} tone={kpis.delayed > 0 ? "warning" : "good"} />
        <KpiCard label={t("kpiCargoValue")} value={formatCurrency(kpis.cargoValueUsd, "USD")} icon={Wallet} />
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter tracking number, e.g. MM-TRK-8842"
        className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              s.id === selectedId ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 text-slate-600"
            }`}
          >
            {s.trackingNumber}
          </button>
        ))}
      </div>

      {relevantBroadcasts.length > 0 && (
        <div className="mb-4">
          <AlertBanner broadcasts={relevantBroadcasts} onDismiss={dismissBroadcast} />
        </div>
      )}

      {!shipment ? (
        <p className="text-sm text-slate-500">{t("noShipmentFound")}</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-semibold">{shipment.trackingNumber}</p>
                <p className="text-xs text-slate-500">
                  {shipment.cargoType} · {shipment.cargoWeightTons}t · {t("driver")}: {shipment.driverName}
                </p>
                <p className="text-xs text-slate-500">
                  {t("cargoValue")}: {formatCurrency(shipment.cargoValue, shipment.cargoValueCurrency)}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {shipment.currentStatus}
              </span>
            </div>
            <MilestoneStepper current={shipment.currentStatus} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-800">{t("liveMap")}</h2>
            <MapView route={route} progress={shipment.routeProgress} gates={gates} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-800">{t("documentViewer")}</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">No checkpoint events yet.</p>
            ) : (
              <ul className="space-y-3">
                {timeline.map((ev) => (
                  <li key={ev.id} className="flex gap-3 rounded-lg border border-slate-100 p-2">
                    {ev.photoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.photoDataUrl} alt="Inspection document" className="h-16 w-16 rounded object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                        no photo
                      </div>
                    )}
                    <div className="flex-1 text-sm">
                      <p className="font-semibold">
                        {ev.checkpointName} — {ev.eventType}
                      </p>
                      {ev.notes && <p className="text-xs text-slate-500">{ev.notes}</p>}
                      <p className="text-[11px] text-slate-400">
                        Recorded {new Date(ev.clientRecordedAt).toLocaleString()} · Synced{" "}
                        {new Date(ev.serverSyncedAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
