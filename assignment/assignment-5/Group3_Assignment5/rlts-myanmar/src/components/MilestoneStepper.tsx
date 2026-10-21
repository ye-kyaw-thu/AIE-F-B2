"use client";

import type { ShipmentStatus } from "@/lib/types";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { useT } from "@/lib/i18n/useT";
import type { TranslationKey } from "@/lib/i18n/translations";

const MILESTONES: { key: ShipmentStatus; labelKey: TranslationKey }[] = [
  { key: "PICKED_UP", labelKey: "milestoneBooked" },
  { key: "IN_TRANSIT", labelKey: "milestoneTransit" },
  { key: "HELD_AT_CHECKPOINT", labelKey: "milestoneCheckpoint" },
  { key: "CUSTOMS_PROCESSING", labelKey: "milestoneCustoms" },
  { key: "DELIVERED", labelKey: "milestoneDelivered" },
];

export default function MilestoneStepper({ current }: { current: ShipmentStatus }) {
  const t = useT();
  const currentIndex = current === "REROUTED" ? 1 : MILESTONES.findIndex((m) => m.key === current);
  // DELIVERED is a finished state, not an in-progress one — show its own step as
  // complete (checkmark) rather than "active" (pulsing dot), which reads as "still
  // working on this."
  const isFinal = current === "DELIVERED";

  return (
    <div className="flex w-full items-center">
      {MILESTONES.map((m, i) => {
        const done = i < currentIndex || (isFinal && i === currentIndex);
        const active = i === currentIndex && !isFinal;
        return (
          <div key={m.key} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              {i !== 0 && (
                <div className={`h-0.5 flex-1 ${done || active ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
              {done && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />}
              {!done && active && <CircleDot className="h-6 w-6 shrink-0 animate-pulse-fast text-sky-600" />}
              {!done && !active && <Circle className="h-6 w-6 shrink-0 text-slate-300" />}
            </div>
            <span className={`mt-1 text-center text-[11px] leading-tight ${active ? "font-semibold text-sky-700" : "text-slate-500"}`}>
              {t(m.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
