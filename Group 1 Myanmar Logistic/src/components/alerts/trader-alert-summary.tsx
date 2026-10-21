import {GateAlertText} from "@/components/i18n/gate-alert-text";

import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {formatDate} from "@/lib/shipments/queries";

export async function TraderAlertSummary(){
  const supabase=await createClient();const {data,error}=await supabase.from("alerts").select("id,title,message,is_read,created_at,gate_id").order("created_at",{ascending:false}).limit(3);
  return <section className="panel alert-summary"><div className="panel-heading"><div><h2><T>Recent alerts</T></h2><p className="panel-subtitle"><T>Gate disruptions and operations notices</T></p></div><Link href="/trader/alerts" className="text-link"><T>View all →</T></Link></div>{error?<p className="dashboard-message" role="alert"><T>Alerts are temporarily unavailable.</T></p>:!data.length?<p className="dashboard-message"><T>No alerts yet.</T></p>:<ul className="alert-list">{data.map(alert=><li key={alert.id} className={alert.is_read?"":"alert-unread"}><span className="alert-state" aria-label={alert.is_read?"Read":"Unread"} /><div><strong>{alert.gate_id?<GateAlertText text={alert.title}/>:alert.title}</strong><p>{alert.gate_id?<GateAlertText text={alert.message}/>:alert.message}</p><time dateTime={alert.created_at}>{formatDate(alert.created_at,true)}</time></div></li>)}</ul>}</section>;
}
