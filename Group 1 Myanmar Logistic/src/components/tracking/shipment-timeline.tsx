
import {T} from "@/components/i18n/language-provider";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/shipments/queries";
import { SHIPMENT_STATUSES,SHIPMENT_STATUS_LABELS,type ShipmentStatus } from "@/types/domain";
import { z } from "zod";

const milestoneSchema=z.array(z.object({status:z.enum(SHIPMENT_STATUSES),first_at:z.string(),last_at:z.string(),event_count:z.number()}));
export async function ShipmentTimeline({shipment,status}:{shipment:string;status:ShipmentStatus}) {
  await requireProfile();const client=await createClient();
  const result=await client.rpc("shipment_milestones",{p_shipment_id:shipment});
  const parsed=milestoneSchema.safeParse(result.data);
  if(result.error||!parsed.success)return <section className="panel dashboard-message" role="alert"><T>Shipment timeline is unavailable. Reload to retry.</T></section>;
  const current=SHIPMENT_STATUSES.indexOf(status);
  return <section className="panel timeline-panel"><div className="panel-heading"><div><h2><T>Shipment progress</T></h2><p className="panel-subtitle"><T>Recorded milestones · Myanmar time</T></p></div></div><ol className="progress-timeline">{SHIPMENT_STATUSES.map((step,index)=>{
    const record=parsed.data.find(row=>row.status===step);const isCurrent=step===status;
    const kind=isCurrent ? "current" : record ? "recorded" : "unrecorded";
    return <li key={step} className={`milestone milestone-${kind}`} aria-current={isCurrent?"step":undefined}><span className="milestone-dot" aria-hidden="true">{isCurrent?"●":record?"✓":index+1}</span><div><h3><T>{SHIPMENT_STATUS_LABELS[step]}</T></h3><p><T>{isCurrent?"Current status":record?(index>current?"Recorded earlier; status corrected":"Recorded"):index<current?"No milestone recorded":"Not reached"}</T></p>{record&&<time dateTime={record.first_at}>{formatDate(record.first_at,true)}</time>}</div></li>;
  })}</ol><p className="timeline-help"><T>Some stages may be skipped. Recorded milestones remain in history after an Admin correction.</T></p></section>;
}
