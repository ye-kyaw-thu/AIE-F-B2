import {GateAlertText} from "@/components/i18n/gate-alert-text";

import {T} from "@/components/i18n/language-provider";
import {Input} from "@/components/i18n/fields";
import Link from "next/link";
import {requireRole} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
import {formatDate} from "@/lib/shipments/queries";
import {setAlertRead} from "@/app/(authenticated)/alerts/actions";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
  const profile=await requireRole("trader"),{error:actionError}=await searchParams,supabase=await createClient();
  const {data,error}=await supabase.from("alerts").select("*").eq("trader_id",profile.id).order("created_at",{ascending:false}).limit(100);
  if(error)throw new Error("Could not load alerts. Refresh to retry.");
  const unread=data.filter(alert=>!alert.is_read).length;
  return <><div className="page-heading"><div><p className="eyebrow"><T>NOTIFICATIONS</T></p><h1><T>Your alerts</T><span>.</span></h1><p className="muted"><T>Gate disruptions and messages from the operations team.</T></p></div><span className="neutral-chip">{unread}<T> unread</T></span></div>{actionError&&<p className="auth-error" role="alert"><T>{actionError==="missing"?"That alert is no longer available.":actionError==="invalid"?"The alert reference was invalid.":"Could not update the alert. Try again."}</T></p>}{!data.length?<section className="panel dashboard-message"><h2><T>No alerts yet</T></h2><p><T>Route disruptions and operations broadcasts will appear here automatically.</T></p></section>:<ol className="alerts-page-list">{data.map(alert=><li className={`panel alert-card ${alert.is_read?"":"alert-unread"}`} key={alert.id}><div className="alert-card-head"><div><span className="alert-kind"><T>{alert.gate_id?"Route disruption":alert.shipment_id?"Shipment update":"Operations broadcast"}</T></span><h2>{alert.gate_id?<GateAlertText text={alert.title}/>:alert.title}</h2></div><span className="neutral-chip"><T>{alert.is_read?"Read":"New"}</T></span></div><p>{alert.gate_id?<GateAlertText text={alert.message}/>:alert.message}</p><div className="alert-card-footer"><time dateTime={alert.created_at}>{formatDate(alert.created_at,true)}</time><div>{alert.shipment_id&&<Link className="text-link" href={`/trader/shipments/${alert.shipment_id}`}><T>View shipment</T></Link>}<form action={setAlertRead} className="alert-read-form"><Input type="hidden" name="id" value={alert.id}/><Input type="hidden" name="read" value={String(!alert.is_read)}/><button className="button signout-button" type="submit"><T>Mark </T><T>{alert.is_read?"unread":"read"}</T></button></form></div></div></li>)}</ol>}</>;
}
