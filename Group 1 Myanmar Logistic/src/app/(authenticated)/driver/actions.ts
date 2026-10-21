"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SHIPMENT_STATUSES } from "@/types/domain";

export type DriverState={message?:string;requestId?:string;occurredAt?:string};
const coordinate=(min:number,max:number)=>z.union([z.literal("").transform(()=>null),z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(min).max(max))]);
const schema=z.object({id:z.uuid(),shipment:z.uuid(),revision:z.iso.datetime({offset:true}),status:z.enum(SHIPMENT_STATUSES),note:z.string().trim().max(2000),latitude:coordinate(-90,90),longitude:coordinate(-180,180),occurredAt:z.iso.datetime({offset:true})})
  .refine(value=>(value.latitude===null)===(value.longitude===null),{message:"Enter both coordinates or leave both blank."});
export async function submitDriverUpdate(_state:DriverState,form:FormData):Promise<DriverState> {
  await requireRole("driver");
  const parsed=schema.safeParse(Object.fromEntries(["id","shipment","revision","status","note","latitude","longitude","occurredAt"].map(key=>[key,form.get(key)])));
  if(!parsed.success) return {message:"Check the status, note and coordinates. Latitude must be −90 to 90 and longitude −180 to 180; provide both or neither."};
  const value=parsed.data;const retry={requestId:value.id,occurredAt:value.occurredAt};
  try {
    const supabase=await createClient();
    const {error}=await supabase.rpc("append_driver_update",{p_id:value.id,p_shipment_id:value.shipment,p_expected_updated_at:value.revision,p_status:value.status,p_note:value.note,p_latitude:value.latitude,p_longitude:value.longitude,p_occurred_at:value.occurredAt});
    if(error) return {...retry,message:error.code==="PT409" ? "This shipment or update changed. Reload and review its latest history before submitting again." : ["PT422","22023"].includes(error.code) ? error.message : "Could not save this update. Check your assignment and try again."};
  } catch {return {...retry,message:"Connection interrupted. Check the shipment history before retrying this update."};}
  for(const path of ["/driver/dashboard",`/driver/shipments/${value.shipment}`,"/trader/dashboard","/trader/shipments",`/trader/shipments/${value.shipment}`,"/admin/dashboard","/admin/shipments",`/admin/shipments/${value.shipment}`]) revalidatePath(path);
  redirect(`/driver/shipments/${value.shipment}?saved=1`);
}
