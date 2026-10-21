
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/types/domain";

export async function AdminShipmentList({ page=1,status,compact=false }: { page?:number;status?:ShipmentStatus;compact?:boolean }) {
  await requireRole("admin");
  const supabase=await createClient(); const size=compact ? 8 : 20;
  let query=supabase.from("shipments").select("id,shipment_number,origin,destination,status,driver_id,gate_statuses(gate_name,status)",{count:"exact"}).order("created_at",{ascending:false}).order("id");
  if(status) query=query.eq("status",status);
  const {data,error,count}=await query.range((page-1)*size,page*size-1);
  const link=(value:number)=>`/admin/shipments?page=${value}${status ? `&status=${status}` : ""}`;
  return <section className="panel"><div className="panel-heading"><div><h2><T>All shipments</T></h2><p className="panel-subtitle"><T>{error ? "Records unavailable" : `${count ?? 0} shipments`}</T></p></div>{compact ? <Link href="/admin/shipments" className="text-link"><T>View all →</T></Link> : <form action="/admin/shipments" className="shipment-filter"><label className="sr-only" htmlFor="admin-filter"><T>Filter status</T></label><select name="status" id="admin-filter" defaultValue={status ?? ""}><option value=""><T>All statuses</T></option>{SHIPMENT_STATUSES.map(value=><option key={value} value={value}><T>{SHIPMENT_STATUS_LABELS[value]}</T></option>)}</select><button className="button signout-button"><T>Filter</T></button></form>}</div>
    {error ? <p className="dashboard-message" role="alert"><T>Could not load shipments. Refresh to retry.</T></p> : !data?.length ? <div className="dashboard-message"><h3><T>No matching shipments</T></h3><Link href="/admin/shipments" className="text-link"><T>Show all shipments</T></Link></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="All shipments"><table><thead><tr><th><T>SHIPMENT / ROUTE</T></th><th><T>STATUS</T></th><th><T>DRIVER</T></th><th><T>GATE</T></th></tr></thead><tbody>{data.map(row=><tr key={row.id}><td><Link className="shipment-number text-link" href={`/admin/shipments/${row.id}`}>{row.shipment_number}</Link><span className="table-subtext">{row.origin} → {row.destination}</span></td><td><StatusBadge status={row.status} /></td><td><T>{row.driver_id ? "Assigned" : "Needs assignment"}</T></td><td>{row.gate_statuses?.gate_name}<span className="table-subtext">{row.gate_statuses && <StatusBadge status={row.gate_statuses.status} />}</span></td></tr>)}</tbody></table></div>}
    {!compact && !error && <div className="table-footer"><span><T>Page </T>{page}<T> of </T>{Math.max(1,Math.ceil((count ?? 0)/size))}</span><nav className="pagination" aria-label="Shipment pages">{page>1 && <Link href={link(page-1)}><T>← Previous</T></Link>}{page*size<(count ?? 0) && <Link href={link(page+1)}><T>Next →</T></Link>}</nav></div>}
  </section>;
}
