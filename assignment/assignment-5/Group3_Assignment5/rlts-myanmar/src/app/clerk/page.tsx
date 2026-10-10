"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/appStore";
import { useAuthStore } from "@/lib/auth/authStore";
import RequireRole, { UserBadge } from "@/components/RequireRole";
import { usersByRole } from "@/lib/auth/users";
import { CURRENCIES, CURRENCY_LABEL } from "@/lib/currency";
import { useT } from "@/lib/i18n/useT";
import type { Currency } from "@/lib/types";
import { PackagePlus } from "lucide-react";

export default function ClerkPage() {
  return (
    <RequireRole role="data_entry_clerk">
      <ClerkIntakeForm />
    </RequireRole>
  );
}

const GATE_OPTIONS = [
  { id: "gate-muse", label: "Northern (China) — Muse 105-Mile Border Trade Zone" },
  { id: "gate-myawaddy", label: "Eastern (Thailand) — Myawaddy Friendship Bridge" },
  { id: "gate-chinshwehaw", label: "Northern (China) — Chinshwehaw Gate" },
];

function ClerkIntakeForm() {
  const t = useT();
  const session = useAuthStore((s) => s.session);
  const createShipment = useAppStore((s) => s.createShipment);
  const drivers = usersByRole("truck_driver");
  const traders = usersByRole("cargo_trader");

  const [driverUsername, setDriverUsername] = useState(drivers[0]?.username ?? "");
  const [traderUsername, setTraderUsername] = useState(traders[0]?.username ?? "");
  const [cargoType, setCargoType] = useState("");
  const [cargoWeightTons, setCargoWeightTons] = useState("");
  const [cargoValue, setCargoValue] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [targetGateId, setTargetGateId] = useState(GATE_OPTIONS[0].id);
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; message?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverUsername || !traderUsername || !cargoType.trim()) return;
    setStatus({ kind: "saving" });
    const result = await createShipment({
      driverUsername,
      traderUsername,
      cargoType: cargoType.trim(),
      cargoWeightTons: Number(cargoWeightTons) || 0,
      cargoValue: Number(cargoValue) || 0,
      cargoValueCurrency: currency,
      targetGateId,
      estimatedArrival: estimatedArrival ? new Date(estimatedArrival).toISOString() : undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      createdBy: session?.username ?? "clerk",
    });
    if (result.ok) {
      setStatus({ kind: "ok", message: t("shipmentCreated") });
      setCargoType("");
      setCargoWeightTons("");
      setCargoValue("");
      setTrackingNumber("");
      setEstimatedArrival("");
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between">
        <Link href="/" className="text-xs text-slate-400 hover:underline">
          ← {t("roleSelector")}
        </Link>
        <UserBadge />
      </div>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-900">
        <PackagePlus className="h-5 w-5" />
        {t("clerkTitle")}
      </h1>
      <p className="mb-4 text-xs text-slate-500">{t("clerkSubtitle")}</p>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("assignDriver")}</label>
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
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("assignTrader")}</label>
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
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("corridor")}</label>
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
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("cargoType")}</label>
          <input
            value={cargoType}
            onChange={(e) => setCargoType(e.target.value)}
            placeholder="e.g. Electronics, Agricultural Produce"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("cargoWeight")}</label>
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
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("cargoValue")}</label>
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
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("currency")}</label>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("trackingNumber")} <span className="text-slate-400">(optional — auto-generated if blank)</span>
            </label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="MM-TRK-####"
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("estimatedArrival")}</label>
            <input
              type="datetime-local"
              value={estimatedArrival}
              onChange={(e) => setEstimatedArrival(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="w-full rounded-md bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {status.kind === "saving" ? "Saving…" : t("createShipment")}
        </button>

        {status.kind === "ok" && <p className="text-center text-xs font-medium text-emerald-700">{status.message}</p>}
        {status.kind === "error" && <p className="text-center text-xs font-medium text-red-600">{status.message}</p>}
      </form>
    </main>
  );
}
