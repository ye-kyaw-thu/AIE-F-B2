"use client";
import {T} from "@/components/i18n/language-provider";
import {Input,Textarea} from "@/components/i18n/fields";


import {useActionState} from "react";
import {sendBroadcast,type AlertActionState} from "@/app/(authenticated)/alerts/actions";

export function BroadcastForm(){
  const [state,action,pending]=useActionState<AlertActionState,FormData>(sendBroadcast,{});
  return <section className="panel"><div className="panel-heading"><div><h2><T>Broadcast to all traders</T></h2><p className="panel-subtitle"><T>Creates a private notification for every Trader account</T></p></div></div><form action={action} className="shipment-form broadcast-form"><fieldset disabled={pending}><div className="form-field"><label htmlFor="broadcast-title"><T>Title </T><span>*</span></label><Input id="broadcast-title" name="title" required maxLength={160} placeholder="Operations notice" /></div><div className="form-field"><label htmlFor="broadcast-message"><T>Message </T><span>*</span></label><Textarea id="broadcast-message" name="message" required maxLength={2000} rows={5} placeholder="Share a concise operational update." /></div><button className="button button-dark" type="submit"><T>{pending?"Sending…":"Send broadcast"}</T></button></fieldset><p role="status" aria-live="polite"><T>{state.message}</T></p></form></section>;
}
