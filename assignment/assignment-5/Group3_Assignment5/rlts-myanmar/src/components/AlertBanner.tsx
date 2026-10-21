"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import type { EmergencyBroadcast } from "@/lib/types";

/** Short synthesized chime via Web Audio API — no audio asset file needed for the demo. */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    // Audio isn't essential to the alert — silently skip if the browser blocks it.
  }
}

export default function AlertBanner({ broadcasts, onDismiss }: { broadcasts: EmergencyBroadcast[]; onDismiss: (id: string) => void }) {
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const critical = broadcasts.find((b) => b.severity === "CRITICAL" && !seenIds.current.has(b.id));
    if (critical) {
      seenIds.current.add(critical.id);
      playChime();
    }
  }, [broadcasts]);

  const active = broadcasts.filter((b) => b.isActive);
  if (active.length === 0) return null;

  return (
    <div className="space-y-2">
      {active.map((b) => (
        <div
          key={b.id}
          className={`flex items-start gap-3 rounded-lg border p-3 shadow-sm ${
            b.severity === "CRITICAL"
              ? "animate-pulse-fast border-red-300 bg-red-50 text-red-900"
              : b.severity === "WARNING"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-sky-300 bg-sky-50 text-sky-900"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{b.title}</p>
            <p className="text-sm">{b.message}</p>
            {b.routeAffected && <p className="mt-1 text-xs opacity-75">Route affected: {b.routeAffected}</p>}
          </div>
          <button
            onClick={() => onDismiss(b.id)}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium opacity-70 hover:bg-black/5 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
