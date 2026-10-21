"use client";

import { Signal, SignalLow, SignalZero } from "lucide-react";
import type { NetworkState } from "@/lib/types";

const OPTIONS: { key: NetworkState; label: string; icon: typeof Signal; activeClass: string }[] = [
  { key: "ONLINE", label: "ONLINE 4G", icon: Signal, activeClass: "bg-emerald-600 text-white" },
  { key: "SLOW_2G", label: "SLOW 2G", icon: SignalLow, activeClass: "bg-amber-500 text-white" },
  { key: "OFFLINE", label: "OFFLINE BLACKOUT", icon: SignalZero, activeClass: "bg-red-600 text-white" },
];

export default function NetworkSimulator({ value, onChange }: { value: NetworkState; onChange: (n: NetworkState) => void }) {
  return (
    <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
      {OPTIONS.map(({ key, label, icon: Icon, activeClass }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
            value === key ? activeClass : "text-slate-500 hover:bg-white"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
