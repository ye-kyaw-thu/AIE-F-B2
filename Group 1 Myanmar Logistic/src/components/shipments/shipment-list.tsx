
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/shipments/queries";
import { StatusBadge } from "@/components/ui/status-badge";
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/types/domain";

export async function ShipmentList({ page = 1, status, compact = false }: { page?: number; status?: ShipmentStatus; compact?: boolean }) {
  const profile = await requireRole("trader");
  const size = compact ? 5 : 20;
  const supabase = await createClient();
  let query = supabase.from("shipments")
    .select("id,shipment_number,origin,destination,cargo_type,quantity,quantity_unit,status,updated_at,gate_statuses(gate_name,status)", { count: "exact" })
    .eq("trader_id", profile.id).order("created_at", { ascending: false }).order("id");
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.range((page - 1) * size, page * size - 1);
  const link = (target: number) => `/trader/shipments?page=${target}${status ? `&status=${status}` : ""}`;

  return <section className="panel trader-shipments">
    <div className="panel-heading"><div><h2><T>{compact ? "Recent shipments" : "Your shipments"}</T></h2><p className="panel-subtitle"><T>{error ? "Records unavailable" : `${count ?? 0} shipment${count === 1 ? "" : "s"}${status ? ` · ${SHIPMENT_STATUS_LABELS[status]}` : ""}`}</T></p></div>{compact ? <Link className="text-link" href="/trader/shipments"><T>View all →</T></Link> : <form className="shipment-filter" action="/trader/shipments"><label className="sr-only" htmlFor="status-filter"><T>Filter by status</T></label><select id="status-filter" name="status" defaultValue={status ?? ""}><option value=""><T>All statuses</T></option>{SHIPMENT_STATUSES.map(value => <option key={value} value={value}><T>{SHIPMENT_STATUS_LABELS[value]}</T></option>)}</select><button type="submit" className="button signout-button"><T>Filter</T></button></form>}</div>
    {error ? <div className="dashboard-message" role="alert"><h3><T>We couldn’t load your shipments.</T></h3><p><T>Refresh the page to try again.</T></p></div> : !data?.length ? <div className="dashboard-message"><h3><T>{status || page > 1 ? "No matching shipments" : "Your first journey starts here"}</T></h3><p><T>{status || page > 1 ? "Choose a different status or return to the first page." : "Create a transport request to get your cargo moving."}</T></p><Link className="text-link" href={status || page > 1 ? "/trader/shipments" : "/trader/shipments/new"}><T>{status || page > 1 ? "Show all shipments" : "Create a request"}</T> →</Link></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Your shipments"><table><thead><tr><th scope="col"><T>SHIPMENT / ROUTE</T></th><th scope="col"><T>CARGO</T></th><th scope="col"><T>STATUS</T></th><th scope="col"><T>BORDER GATE</T></th><th scope="col"><T>LAST UPDATED</T></th></tr></thead><tbody>{data.map(shipment => <tr key={shipment.id}><td><Link className="shipment-number text-link" href={`/trader/shipments/${shipment.id}`}>{shipment.shipment_number}</Link><span className="table-subtext">{shipment.origin} → {shipment.destination}</span></td><td>{shipment.cargo_type}<span className="table-subtext">{shipment.quantity} <T>{shipment.quantity_unit}</T></span></td><td><StatusBadge status={shipment.status} /></td><td><T>{shipment.gate_statuses?.gate_name ?? "Unavailable"}</T><span className="table-subtext">{shipment.gate_statuses && <StatusBadge status={shipment.gate_statuses.status} />}</span></td><td>{formatDate(shipment.updated_at, true)}</td></tr>)}</tbody></table></div>}
    {!compact && !error && <div className="table-footer"><span><T>Page </T>{page}<T> of </T>{Math.max(1, Math.ceil((count ?? 0) / size))}</span><nav aria-label="Shipment pages" className="pagination">{page > 1 && <Link href={link(page - 1)}><T>← Previous</T></Link>}{page * size < (count ?? 0) && <Link href={link(page + 1)}><T>Next →</T></Link>}</nav></div>}
  </section>;
}
