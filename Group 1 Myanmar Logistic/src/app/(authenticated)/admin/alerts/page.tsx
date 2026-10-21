import {GateAlertText} from "@/components/i18n/gate-alert-text";

import {T} from "@/components/i18n/language-provider";
import {requireRole} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
import {formatDate} from "@/lib/shipments/queries";
import {BroadcastForm} from "@/components/alerts/broadcast-form";

export default async function Page({searchParams}:{searchParams:Promise<{sent?:string}>}){
  await requireRole("admin");const {sent}=await searchParams,supabase=await createClient();
  const [alerts,traders]=await Promise.all([supabase.from("alerts").select("*").order("created_at",{ascending:false}).limit(50),supabase.from("profiles").select("id,full_name,email").eq("role","trader")]);
  if(alerts.error||traders.error)throw new Error("Could not load alert management. Refresh to retry.");
  const names=new Map(traders.data.map(row=>[row.id,row]));
  return <><div className="page-heading"><div><p className="eyebrow"><T>COMMUNICATIONS</T></p><h1><T>Alerts</T><span>.</span></h1><p className="muted"><T>Notify Traders about network-wide operations. Gate disruption alerts are automatic.</T></p></div><span className="neutral-chip">{traders.data.length}<T> traders</T></span></div>{sent&&<p className="success-notice" role="status"><T>Broadcast sent to </T>{sent}<T> trader</T>{sent==="1"?"":"s"}.</p>}<div className="alerts-admin-grid"><BroadcastForm/><section className="panel"><div className="panel-heading"><div><h2><T>Recent alert deliveries</T></h2><p className="panel-subtitle"><T>Latest 50 recipient records</T></p></div></div>{!alerts.data.length?<p className="dashboard-message"><T>No alerts have been delivered yet.</T></p>:<ul className="alert-list admin-alert-list">{alerts.data.map(alert=>{const trader=names.get(alert.trader_id);return <li key={alert.id}><span className="alert-state"/><div><strong>{alert.gate_id?<GateAlertText text={alert.title}/>:alert.title}</strong><p>{alert.gate_id?<GateAlertText text={alert.message}/>:alert.message}</p><small><T>{trader?.full_name??"Trader"}</T> · {trader?.email??alert.trader_id}</small><time dateTime={alert.created_at}>{formatDate(alert.created_at,true)}</time></div></li>})}</ul>}</section></div></>;
}
