"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/appStore";
import { useAuthStore } from "@/lib/auth/authStore";
import RequireRole, { UserBadge } from "@/components/RequireRole";
import GateTogglePanel from "@/components/GateTogglePanel";
import MapView from "@/components/MapView";
import { NORTHERN_CORRIDOR, EASTERN_CORRIDOR } from "@/lib/geo/myanmar-routes";
import { formatCurrency, CURRENCIES, CURRENCY_LABEL } from "@/lib/currency";
import { useT } from "@/lib/i18n/useT";
import { usersByRole } from "@/lib/auth/users";
import { computeFleetKpis } from "@/lib/kpis";
import KpiCard from "@/components/KpiCard";
import type { BroadcastSeverity, Currency, Shipment } from "@/lib/types";
import {
  AlertTriangle,
  Boxes,
  DoorClosed,
  DoorOpen,
  Megaphone,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Timer,
  Trash2,
  Truck,
  Wallet,
  X,
} from "lucide-react";

const GATE_OPTIONS = [
  { id: "gate-muse", label: "Northern (China) — Muse 105-Mile Border Trade Zone" },
  { id: "gate-myawaddy", label: "Eastern (Thailand) — Myawaddy Friendship Bridge" },
  { id: "gate-chinshwehaw", label: "Northern (China) — Chinshwehaw Gate" },
];

export default function AdminPage() {
  return (
    <RequireRole role="logistics_admin">
      <AdminConsole />
    </RequireRole>
  );
}

function AdminConsole() {
  const t = useT();
  const session = useAuthStore((s) => s.session);
  const gates = useAppStore((s) => s.gates);
  const shipments = useAppStore((s) => s.shipments);
  const broadcasts = useAppStore((s) => s.broadcasts);
  const toggleGate = useAppStore((s) => s.toggleGate);
  const createBroadcast = useAppStore((s) => s.createBroadcast);
  const dismissBroadcast = useAppStore((s) => s.dismissBroadcast);
  const deleteShipment = useAppStore((s) => s.deleteShipment);
  const resetDemo = useAppStore((s) => s.resetDemo);

  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<BroadcastSeverity>("CRITICAL");
  const [alertGateId, setAlertGateId] = useState(gates[0]?.id ?? "");
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  // Which shipment the Fleet Live Map is focused on. Falls back to the first shipment
  // whenever the selection doesn't (or no longer) exists — e.g. right after a delete,
  // or on first load before anything's been clicked.
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  // Confirming in-app rather than via window.confirm() — Chrome silently suppresses
  // native JS dialogs after a page has already triggered several in the same session
  // (this page's password-manager prompts count toward that same limit), so a delete
  // confirmation could just never appear and the click would silently no-op.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    await deleteShipment(id);
    setConfirmingDeleteId(null);
  }

  const focusedShipment = shipments.find((s) => s.id === selectedShipmentId) ?? shipments[0];
  const route = focusedShipment?.destinationName.includes("Muse") ? NORTHERN_CORRIDOR : EASTERN_CORRIDOR;
  const kpis = computeFleetKpis(shipments, gates, broadcasts);

  function submitBroadcast() {
    if (!alertTitle.trim() || !alertMessage.trim()) return;
    const gate = gates.find((g) => g.id === alertGateId);
    createBroadcast({
      title: alertTitle,
      message: alertMessage,
      severity: alertSeverity,
      gateId: alertGateId || null,
      routeAffected: gate?.corridor ?? null,
    });
    setAlertTitle("");
    setAlertMessage("");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-slate-400 hover:underline">
            ← {t("roleSelector")}
          </Link>
          <h1 className="text-xl font-bold text-slate-900">{t("adminTitle")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <UserBadge />
          <button
            onClick={resetDemo}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("resetDemo")}
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label={t("kpiActiveShipments")} value={kpis.activeShipments} icon={Truck} />
        <KpiCard label={t("kpiDelayed")} value={kpis.delayed} icon={AlertTriangle} tone={kpis.delayed > 0 ? "warning" : "good"} />
        <KpiCard label={t("kpiCargoValue")} value={formatCurrency(kpis.cargoValueUsd, "USD")} icon={Wallet} />
        <KpiCard
          label={t("kpiGatesClosed")}
          value={kpis.gatesClosed}
          icon={DoorClosed}
          tone={kpis.gatesClosed > 0 ? "critical" : "good"}
        />
        <KpiCard
          label={t("kpiActiveAlerts")}
          value={kpis.activeCriticalAlerts}
          icon={ShieldAlert}
          tone={kpis.activeCriticalAlerts > 0 ? "critical" : "good"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{t("fleetMap")}</h2>
              {focusedShipment && (
                <span className="font-mono text-xs text-slate-400">{focusedShipment.trackingNumber}</span>
              )}
            </div>

            {shipments.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="mr-1 self-center text-[11px] text-slate-400">{t("selectShipmentHint")}</span>
                {shipments.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShipmentId(s.id)}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                      s.id === focusedShipment?.id
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {s.trackingNumber}
                  </button>
                ))}
              </div>
            )}

            {focusedShipment && <MapView route={route} progress={focusedShipment.routeProgress} gates={gates} />}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-800">{t("manifest")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="py-1.5 pr-2">{t("trackingNumber")}</th>
                    <th className="py-1.5 pr-2">Route</th>
                    <th className="py-1.5 pr-2">{t("driver")}</th>
                    <th className="py-1.5 pr-2">Trader</th>
                    <th className="py-1.5 pr-2">{t("cargoValue")}</th>
                    <th className="py-1.5 pr-2">{t("status")}</th>
                    <th className="py-1.5 pr-2">{t("delayed")}</th>
                    <th className="py-1.5 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedShipmentId(s.id)}
                      title="Click to focus this shipment on the Fleet Live Map above"
                      className={`cursor-pointer border-b border-slate-100 ${
                        s.currentStatus === "DELIVERED"
                          ? "text-slate-400"
                          : s.id === focusedShipment?.id
                            ? "bg-sky-50"
                            : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2 pr-2 font-mono text-xs">{s.trackingNumber}</td>
                      <td className="py-2 pr-2 text-xs">
                        {s.originName.split(" ")[0]} → {s.destinationName.split(" ")[0]}
                      </td>
                      <td className="py-2 pr-2 text-xs">{s.driverName}</td>
                      <td className="py-2 pr-2 text-xs">{s.traderName}</td>
                      <td className="py-2 pr-2 text-xs">{formatCurrency(s.cargoValue, s.cargoValueCurrency)}</td>
                      <td
                        className={`py-2 pr-2 text-xs font-semibold ${s.currentStatus === "DELIVERED" ? "text-emerald-600" : ""}`}
                      >
                        {s.currentStatus}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {s.isDelayed ? <span className="text-red-600">{s.delayReason ?? "Yes"}</span> : "No"}
                      </td>
                      <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                        {confirmingDeleteId === s.id ? (
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span className="text-[11px] text-red-600">Delete?</span>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingShipment(s)}
                              title="Edit shipment"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(s.id)}
                              title="Delete shipment"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-800">{t("gateControl")}</h2>
            <GateTogglePanel
              gates={gates}
              onToggle={(id, status, reason) => toggleGate(id, status, reason, session?.username ?? "admin")}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-slate-800">
              <Megaphone className="h-4 w-4" /> {t("broadcastAlert")}
            </h2>
            <div className="space-y-2">
              <input
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="Title, e.g. Lashio bypass blocked"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
              <textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="Message shown to affected traders and drivers"
                rows={3}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={alertGateId}
                  onChange={(e) => setAlertGateId(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={alertSeverity}
                  onChange={(e) => setAlertSeverity(e.target.value as BroadcastSeverity)}
                  className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <button
                onClick={submitBroadcast}
                className="w-full rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                {t("sendBroadcast")}
              </button>
            </div>

            {broadcasts.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-xs">
                {broadcasts.map((b) => (
                  <li key={b.id} className={`flex items-center justify-between rounded px-2 py-1 ${b.isActive ? "bg-slate-50" : "bg-slate-50 opacity-40"}`}>
                    <span>
                      <strong>{b.severity}</strong> — {b.title}
                    </span>
                    {b.isActive && (
                      <button onClick={() => dismissBroadcast(b.id)} className="text-slate-400 hover:text-slate-700">
                        dismiss
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {editingShipment && (
        <EditShipmentModal shipment={editingShipment} onClose={() => setEditingShipment(null)} />
      )}
    </main>
  );
}

function EditShipmentModal({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const updateShipment = useAppStore((s) => s.updateShipment);
  const drivers = usersByRole("truck_driver");
  const traders = usersByRole("cargo_trader");

  const [trackingNumber, setTrackingNumber] = useState(shipment.trackingNumber);
  const [driverUsername, setDriverUsername] = useState(shipment.driverUsername ?? drivers[0]?.username ?? "");
  const [traderUsername, setTraderUsername] = useState(shipment.traderUsername ?? traders[0]?.username ?? "");
  const [cargoType, setCargoType] = useState(shipment.cargoType);
  const [cargoWeightTons, setCargoWeightTons] = useState(String(shipment.cargoWeightTons));
  const [cargoValue, setCargoValue] = useState(String(shipment.cargoValue));
  const [currency, setCurrency] = useState<Currency>(shipment.cargoValueCurrency);
  const [targetGateId, setTargetGateId] = useState(shipment.targetGateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateShipment(shipment.id, {
      trackingNumber,
      driverUsername,
      traderUsername,
      cargoType,
      cargoWeightTons: Number(cargoWeightTons) || 0,
      cargoValue: Number(cargoValue) || 0,
      cargoValueCurrency: currency,
      targetGateId,
    });
    setSaving(false);
    if (result.ok) onClose();
    else setError(result.error ?? "Failed to save.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Edit Shipment</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tracking #</label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Driver</label>
              <select
                value={driverUsername}
                onChange={(e) => setDriverUsername(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                {drivers.map((d) => (
                  <option key={d.username} value={d.username}>
                    {d.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Trader</label>
              <select
                value={traderUsername}
                onChange={(e) => setTraderUsername(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                {traders.map((tr) => (
                  <option key={tr.username} value={tr.username}>
                    {tr.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Corridor / Destination Gate</label>
            <select
              value={targetGateId}
              onChange={(e) => setTargetGateId(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            >
              {GATE_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Cargo Type</label>
            <input
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Weight (t)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={cargoWeightTons}
                onChange={(e) => setCargoWeightTons(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Value</label>
              <input
                type="number"
                min="0"
                step="1"
                value={cargoValue}
                onChange={(e) => setCargoValue(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-md bg-slate-800 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
