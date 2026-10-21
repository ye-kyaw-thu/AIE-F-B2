
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { getDriverShipment } from "@/lib/driver/queries";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/status-badge";
import { DriverUpdateForm } from "@/components/driver/update-form";
import { EvidenceUpload } from "@/components/driver/evidence-upload";
import { OfflineManager } from "@/components/driver/offline-manager";
import { ShipmentDocuments } from "@/components/shipments/documents";
import { ShipmentMap } from "@/components/tracking/shipment-map";
import { ShipmentTimeline } from "@/components/tracking/shipment-timeline";
import { formatDate } from "@/lib/shipments/queries";

export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}) {
  const profile=await requireRole("driver");
  const {id}=await params;const shipment=await getDriverShipment(id);const {saved}=await searchParams;const gate=shipment.gate_statuses;
  const supabase=await createClient();const {data:updates,error}=await supabase.from("shipment_updates").select("id,status,note,created_at,sync_status").eq("shipment_id",id).order("created_at",{ascending:false}).order("id").limit(20);
  return <><Link href="/driver/dashboard" className="back-link"><T>← My assignments</T></Link><div className="page-heading"><div><p className="eyebrow"><T>DRIVER ASSIGNMENT</T></p><h1>{shipment.shipment_number}</h1><p className="muted">{shipment.origin} → {shipment.destination}</p></div><StatusBadge status={shipment.status} /></div>{saved==="1"&&<p className="success-notice" role="status"><T>Shipment update saved · Synced</T></p>}<section className="panel"><div className="panel-heading"><h2><T>Trip details</T></h2>{gate&&<StatusBadge status={gate.status} />}</div><dl className="shipment-facts">{[["Cargo",`${shipment.cargo_type} · ${shipment.quantity} ${shipment.quantity_unit}`],["Pickup",formatDate(shipment.pickup_date)],["Description",shipment.cargo_description],["Instructions",shipment.special_notes||"No special notes"],["Gate",`${gate?.gate_name ?? "Unavailable"} · ${gate?.reason || "No disruption note"}`],["Updated",formatDate(shipment.updated_at,true)]].map(([label,value])=><div key={label}><dt><T>{label}</T></dt><dd>{value}</dd></div>)}</dl></section>
    {shipment.status==="requested" ? <section className="panel dashboard-message"><h2><T>Awaiting approval</T></h2><p><T>Operations must approve this assignment before you can update it or upload evidence.</T></p></section> : <>{shipment.status==="delivered" ? <section className="panel dashboard-message"><h2><T>Delivery complete</T></h2><p><T>Progress is locked. You can still upload a delivery receipt or supporting evidence.</T></p></section> : <DriverUpdateForm shipment={id} revision={shipment.updated_at} status={shipment.status} requestId={crypto.randomUUID()} occurredAt={new Date().toISOString()} userId={profile.id} shipmentNumber={shipment.shipment_number} />}<EvidenceUpload shipment={id} driver={shipment.driver_id!} /></>}
    <OfflineManager userId={profile.id} />
    <ShipmentTimeline shipment={id} status={shipment.status} /><ShipmentDocuments shipment={id} /><ShipmentMap origin={shipment.origin} destination={shipment.destination} gate={gate?.gate_name ?? ""} latitude={shipment.current_lat} longitude={shipment.current_lng} />
    <section className="panel history-panel"><div className="panel-heading"><h2><T>Recent updates</T></h2><span className="neutral-chip"><T>Latest 20</T></span></div>{error ? <p className="dashboard-message"><T>History unavailable. Refresh to retry.</T></p> : <ol className="shipment-history">{updates.map(update=><li key={update.id}><StatusBadge status={update.status} /><div><p><T>{update.note||"Shipment progress updated"}</T></p><time dateTime={update.created_at}>{formatDate(update.created_at,true)}<T> · Synced</T></time></div></li>)}</ol>}</section></>;
}
