
import {T} from "@/components/i18n/language-provider";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/shipments/queries";
import { StatusBadge } from "@/components/ui/status-badge";
import { GateForm } from "@/components/admin/management-forms";

export default async function Page({searchParams}:{searchParams:Promise<{saved?:string}>}) {
  await requireRole("admin"); const {saved}=await searchParams; const supabase=await createClient();
  const {data,error}=await supabase.from("gate_statuses").select("*").order("gate_name");
  if(error) throw new Error("Could not load gates. Refresh to retry.");
  return <><div className="page-heading"><div><p className="eyebrow"><T>BORDER OPERATIONS</T></p><h1><T>Border gates</T><span>.</span></h1><p className="muted"><T>Keep route conditions and disruption reasons up to date.</T></p></div><span className="neutral-chip"><T>Simulated conditions</T></span></div>{saved==="1" && <p className="success-notice" role="status"><T>Gate status updated.</T></p>}<div className="detail-grid">{data.map(gate=><section className="panel" key={gate.id}><div className="panel-heading"><div><h2>{gate.gate_name}<T> Gate</T></h2><p className="panel-subtitle">{gate.location}</p></div><StatusBadge status={gate.status} /></div><GateForm key={gate.id} id={gate.id} updatedAt={gate.updated_at} status={gate.status} reason={gate.reason} /><p className="map-caption"><T>Updated </T>{formatDate(gate.updated_at,true)}</p></section>)}</div>{!data.length && <p className="dashboard-message"><T>No border gates have been configured.</T></p>}</>;
}
