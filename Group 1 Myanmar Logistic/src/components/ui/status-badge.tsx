
import {T} from "@/components/i18n/language-provider";
import { SHIPMENT_STATUS_LABELS, type GateStatus, type ShipmentStatus } from "@/types/domain";

export function StatusBadge({ status }: { status: ShipmentStatus | GateStatus }) {
  const label = status in SHIPMENT_STATUS_LABELS
    ? SHIPMENT_STATUS_LABELS[status as ShipmentStatus]
    : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`status-badge status-${status}`}><span className="status-dot" /><T>{label}</T></span>;
}
