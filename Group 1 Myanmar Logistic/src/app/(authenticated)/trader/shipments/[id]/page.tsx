
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { getTraderShipment, formatDate } from "@/lib/shipments/queries";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShipmentMap } from "@/components/tracking/shipment-map";
import { ShipmentTimeline } from "@/components/tracking/shipment-timeline";
import { ShipmentDocuments } from "@/components/shipments/documents";

export default async function ShipmentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const shipment = await getTraderShipment(id);
  const { saved } = await searchParams;
  const supabase = await createClient();
  const [driver, updates] = await Promise.all([
    supabase.rpc("shipment_driver_name", { p_shipment_id: id }),
    supabase.from("shipment_updates").select("id,status,note,created_at").eq("shipment_id", id).order("created_at", { ascending: false }).order("id").limit(20),
  ]);
  const gate = shipment.gate_statuses;
  return <>
    <Link className="back-link" href="/trader/shipments"><T>← My shipments</T></Link>
    <div className="page-heading detail-heading"><div><p className="eyebrow"><T>SHIPMENT DETAILS</T></p><h1>{shipment.shipment_number}</h1><p className="muted">{shipment.origin} → {shipment.destination}</p></div><div className="detail-actions"><StatusBadge status={shipment.status} />{shipment.status === "requested" && <Link className="button button-dark" href={`/trader/shipments/${id}/edit`}><T>Edit request</T></Link>}</div></div>
    {(saved === "created" || saved === "updated") && <div className="success-notice" role="status"><T>{saved === "created" ? "Transport request submitted. The operations team can now review it." : "Your transport request has been updated."}</T></div>}
    <div className="detail-grid"><section className="panel"><div className="panel-heading"><h2><T>Journey & cargo</T></h2></div><dl className="shipment-facts"><Fact label="Origin" value={shipment.origin} /><Fact label="Destination" value={shipment.destination} /><Fact label="Pickup date" value={formatDate(shipment.pickup_date)} /><Fact label="Assigned driver" value={driver.error ? "Temporarily unavailable" : driver.data || "Awaiting assignment"} /><Fact label="Cargo type" value={shipment.cargo_type} /><Fact label="Quantity" value={`${shipment.quantity} $<T>{shipment.quantity_unit}</T>`} /><Fact label="Cargo description" value={shipment.cargo_description} wide /><Fact label="Special notes" value={shipment.special_notes || "No special notes."} wide /></dl></section>
      <section className="panel"><div className="panel-heading"><h2><T>Route & progress</T></h2></div><div className="detail-progress"><p className="eyebrow"><T>BORDER GATE</T></p><h3><T>{gate?.gate_name ?? "Unavailable"}</T><T> Gate</T></h3>{gate && <StatusBadge status={gate.status} />}{gate?.reason && <p className="gate-reason">{gate.reason}</p>}<hr /><p className="eyebrow"><T>CURRENT STATUS</T></p><StatusBadge status={shipment.status} /><p className="progress-explanation"><T>{shipment.status === "requested" ? "Awaiting approval and driver coordination from the operations team." : shipment.status === "delivered" ? "Your shipment has been delivered." : "Your shipment is progressing through its journey."}</T></p><p className="detail-time"><T>Last updated </T>{formatDate(shipment.updated_at, true)}<br /><T>Created </T>{formatDate(shipment.created_at, true)}<br /><T>All times shown in Myanmar time.</T></p></div></section></div>
    <ShipmentTimeline shipment={id} status={shipment.status} /><ShipmentDocuments shipment={id} /><ShipmentMap origin={shipment.origin} destination={shipment.destination} gate={gate?.gate_name ?? ""} latitude={shipment.current_lat} longitude={shipment.current_lng} />
    <section className="panel history-panel"><div className="panel-heading"><h2><T>Recent shipment updates</T></h2><span className="neutral-chip"><T>Latest 20</T></span></div>{updates.error ? <p className="dashboard-message" role="alert"><T>Updates are temporarily unavailable. Refresh to try again.</T></p> : !updates.data?.length ? <p className="dashboard-message"><T>No updates have been recorded yet.</T></p> : <ol className="shipment-history">{updates.data.map(update => <li key={update.id}><StatusBadge status={update.status} /><div><p><T>{update.note || "Shipment status updated."}</T></p><time dateTime={update.created_at}>{formatDate(update.created_at, true)}</time></div></li>)}</ol>}</section>
  </>;
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "span-two" : ""}><dt><T>{label}</T></dt><dd>{value}</dd></div>;
}
