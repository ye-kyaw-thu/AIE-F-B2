"use client";

import { useState } from "react";
import type { BorderGate, GateStatus } from "@/lib/types";

const STATUS_OPTIONS: Record<string, GateStatus[]> = {
  GATE_MUSE_105: ["OPEN", "CONGESTED", "CLOSED", "ARMED_INSPECTION"],
  GATE_MYAWADDY_FRIENDSHIP: ["OPEN", "CONGESTED", "CLOSED", "FLOODING"],
  GATE_CHINSHWEHAW: ["OPEN", "CLOSED"],
};

const STATUS_STYLE: Record<GateStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CONGESTED: "bg-amber-100 text-amber-800 border-amber-300",
  CLOSED: "bg-red-100 text-red-800 border-red-300",
  ARMED_INSPECTION: "bg-red-100 text-red-800 border-red-300",
  FLOODING: "bg-red-100 text-red-800 border-red-300",
  EMERGENCY_HALT: "bg-red-100 text-red-800 border-red-300",
};

export default function GateTogglePanel({
  gates,
  onToggle,
}: {
  gates: BorderGate[];
  onToggle: (gateId: string, status: GateStatus, reason: string | null) => void;
}) {
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      {gates.map((gate) => {
        const options = STATUS_OPTIONS[gate.code] ?? ["OPEN", "CLOSED"];
        return (
          <div key={gate.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{gate.name}</p>
                <p className="text-xs text-slate-500">{gate.corridor}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[gate.status]}`}>
                {gate.status}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onToggle(gate.id, opt, reasonDraft[gate.id] ?? null)}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                    gate.status === opt
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <input
              value={reasonDraft[gate.id] ?? ""}
              onChange={(e) => setReasonDraft((prev) => ({ ...prev, [gate.id]: e.target.value }))}
              placeholder="Closure reason (optional) — attached to the next status change"
              className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
            />

            {gate.closureReason && (
              <p className="mt-1 text-xs italic text-slate-500">Last note: {gate.closureReason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
