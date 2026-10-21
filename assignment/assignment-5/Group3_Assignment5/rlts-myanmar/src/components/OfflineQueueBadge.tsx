import { CheckCircle2, CloudUpload } from "lucide-react";

export default function OfflineQueueBadge({ pendingCount }: { pendingCount: number }) {
  if (pendingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All data synced
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
      <CloudUpload className="h-3.5 w-3.5" />
      {pendingCount} update{pendingCount > 1 ? "s" : ""} cached locally (syncing automatically)
    </div>
  );
}
