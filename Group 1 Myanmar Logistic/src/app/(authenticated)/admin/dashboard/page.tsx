
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AdminShipmentList } from "@/components/admin/shipment-list";

export default async function Page() {
  const profile=await requireRole("admin"); const supabase=await createClient();
  const counts=await Promise.all([
    supabase.from("shipments").select("id",{count:"exact",head:true}),
    supabase.from("shipments").select("id",{count:"exact",head:true}).eq("status","requested"),
    supabase.from("shipments").select("id",{count:"exact",head:true}).is("driver_id",null),
    supabase.from("gate_statuses").select("id",{count:"exact",head:true}).neq("status","open"),
  ]);
  return <><div className="page-heading"><div><p className="eyebrow"><T>OPERATIONS OVERVIEW</T></p><h1><T>Welcome, </T>{profile.full_name.split(" ")[0]}<span>.</span></h1><p className="muted"><T>Keep shipments moving across your trading network.</T></p></div><Link href="/admin/gates" className="button button-dark"><T>Manage border gates →</T></Link></div><div className="admin-stats">{["All shipments","Awaiting approval","Needs driver","Disrupted gates"].map((label,index)=><section className="panel admin-stat" key={label}><p><T>{label}</T></p><strong>{counts[index].error ? "—" : counts[index].count ?? 0}</strong></section>)}</div>{counts.some(result=>result.error) && <p role="alert"><T>Some counts are unavailable. Refresh to retry.</T></p>}<AdminShipmentList compact /></>;
}
