
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { getAdminShipment } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/shipments/queries";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShipmentManagement } from "@/components/admin/management-forms";
import { ShipmentMap } from "@/components/tracking/shipment-map";
import { ShipmentTimeline } from "@/components/tracking/shipment-timeline";
import { ShipmentDocuments } from "@/components/shipments/documents";

export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}) {
  const {id}=await params; const shipment=await getAdminShipment(id); const {saved}=await searchParams;
  const supabase=await createClient();
  const [drivers,people,updates,progress]=await Promise.all([
    supabase.from("profiles").select("id,full_name").eq("role","driver").eq("driver_access","active").order("full_name"),
    supabase.from("profiles").select("id,full_name").in("id",[shipment.trader_id,...(shipment.driver_id ? [shipment.driver_id] : [])]),
    supabase.from("shipment_updates").select("id,status,note,created_at").eq("shipment_id",id).order("created_at",{ascending:false}).order("id").limit(20),
    supabase.from("shipment_updates").select("id",{count:"exact",head:true}).eq("shipment_id",id).not("status","in","(requested,approved)"),
  ]);
  if(drivers.error || people.error || progress.error) throw new Error("Could not load shipment management data. Refresh to retry.");
  const name=(person:string|null)=>people.data.find(row=>row.id===person)?.full_name ?? "Awaiting assignment";
  const gate=shipment.gate_statuses;
  const facts=[["Trader",name(shipment.trader_id)],["Assigned driver",name(shipment.driver_id)],["Pickup date",formatDate(shipment.pickup_date)],["Cargo",shipment.cargo_type],["Quantity",`${shipment.quantity} ${shipment.quantity_unit}`],["Gate",gate?.gate_name ?? "Unavailable"],["Cargo description",shipment.cargo_description],["Special notes",shipment.special_notes || "None"]];
  return <><Link href="/admin/shipments" className="back-link"><T>← All shipments</T></Link><div className="page-heading"><div><p className="eyebrow"><T>SHIPMENT MANAGEMENT</T></p><h1>{shipment.shipment_number}</h1><p className="muted">{shipment.origin} → {shipment.destination}</p></div><StatusBadge status={shipment.status} /></div>{saved==="1" && <p className="success-notice" role="status"><T>Shipment updated.</T></p>}
    <section className="panel"><div className="panel-heading"><h2><T>Shipment details</T></h2>{gate && <StatusBadge status={gate.status} />}</div><dl className="shipment-facts">{facts.map(([label,value])=><div key={label}><dt><T>{label}</T></dt><dd>{value}</dd></div>)}</dl><p className="map-caption"><T>Last updated </T>{formatDate(shipment.updated_at,true)}{gate?.reason && ` · Gate note: ${gate.reason}`}</p></section>
    <ShipmentManagement key={id} id={id} updatedAt={shipment.updated_at} status={shipment.status} driverId={shipment.driver_id} drivers={drivers.data} assignmentLocked={!["requested","approved"].includes(shipment.status)||(progress.count ?? 0)>0} />
    <ShipmentTimeline shipment={id} status={shipment.status} /><ShipmentDocuments shipment={id} /><ShipmentMap origin={shipment.origin} destination={shipment.destination} gate={gate?.gate_name ?? ""} latitude={shipment.current_lat} longitude={shipment.current_lng} />
    <section className="panel history-panel"><div className="panel-heading"><h2><T>Recent shipment updates</T></h2><span className="neutral-chip"><T>Latest 20</T></span></div>{updates.error ? <p className="dashboard-message" role="alert"><T>Updates unavailable. Refresh to retry.</T></p> : !updates.data.length ? <p className="dashboard-message"><T>No recorded updates yet.</T></p> : <ol className="shipment-history">{updates.data.map(row=><li key={row.id}><StatusBadge status={row.status} /><div><p>{row.note}</p><time dateTime={row.created_at}>{formatDate(row.created_at,true)}</time></div></li>)}</ol>}</section>
  </>;
}
