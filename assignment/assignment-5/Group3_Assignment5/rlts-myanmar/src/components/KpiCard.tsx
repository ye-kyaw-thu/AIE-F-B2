import type { LucideIcon } from "lucide-react";

const TONE_CLASSES = {
  neutral: "bg-slate-50 text-slate-800 border-slate-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  critical: "bg-red-50 text-red-800 border-red-200",
  good: "bg-emerald-50 text-emerald-800 border-emerald-200",
} as const;

export default function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <div className={`rounded-xl border p-3 ${TONE_CLASSES[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
