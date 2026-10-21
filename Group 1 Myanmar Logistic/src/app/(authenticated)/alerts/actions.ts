"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AlertActionState={message?:string};
const broadcastSchema=z.object({title:z.string().trim().min(1).max(160),message:z.string().trim().min(1).max(2000)});

export async function sendBroadcast(_state:AlertActionState,form:FormData):Promise<AlertActionState>{
  await requireRole("admin");
  const parsed=broadcastSchema.safeParse({title:form.get("title"),message:form.get("message")});
  if(!parsed.success)return {message:"Enter a title and message within the allowed lengths."};
  let sent:number;
  try{
    const supabase=await createClient();const result=await supabase.rpc("broadcast_alert",{p_title:parsed.data.title,p_message:parsed.data.message});
    if(result.error)return {message:result.error.code==="42501"?"Administrator access is required.":result.error.code==="22023"?result.error.message:"Could not send the broadcast. Try again."};
    sent=result.data;
  }catch{return {message:"Connection interrupted. Reload alerts to check whether the broadcast was sent."};}
  revalidatePath("/admin/alerts");revalidatePath("/trader","layout");
  redirect(`/admin/alerts?sent=${sent}`);
}

export async function setAlertRead(form:FormData){
  await requireRole("trader");
  const parsed=z.object({id:z.uuid(),read:z.enum(["true","false"])}).safeParse({id:form.get("id"),read:form.get("read")});
  if(!parsed.success)redirect("/trader/alerts?error=invalid");
  const supabase=await createClient();let result;
  try{result=await supabase.rpc("mark_alert_read",{p_id:parsed.data.id,p_is_read:parsed.data.read==="true"});}catch{redirect("/trader/alerts?error=save");}
  if(result.error)redirect(`/trader/alerts?error=${result.error.code==="PT404"?"missing":"save"}`);
  revalidatePath("/trader","layout");redirect("/trader/alerts");
}
