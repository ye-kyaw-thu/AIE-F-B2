"use client";
import {useActionState} from "react";
import {T} from "@/components/i18n/language-provider";
import {Input} from "@/components/i18n/fields";
import {inviteDriver,resendDriverInvitation,changeDriverAccess} from "@/app/(authenticated)/admin/drivers/actions";
import type {DriverFormState} from "@/lib/drivers/validation";

export function InviteDriverForm({configured}:{configured:boolean}){
  const [state,action,pending]=useActionState<DriverFormState,FormData>(inviteDriver,{});
  return <form action={action} className="shipment-form"><fieldset disabled={!configured||pending}><legend><T>Invite a Driver</T></legend>{([['fullName','Full name'],['email','Email address'],['phone','Phone number']] as const).map(([name,label])=><div className="form-field" key={name}><label htmlFor={name}><T>{label}</T>{name==='phone'&&<small><T>Optional</T></small>}</label><Input id={name} name={name} required={name!=='phone'} type={name==='email'?'email':name==='phone'?'tel':'text'} autoComplete={name==='fullName'?'name':name==='email'?'email':'tel'} minLength={name==='fullName'?2:undefined} maxLength={name==='fullName'?120:name==='email'?320:40} aria-invalid={!!state.errors?.[name]} aria-describedby={state.errors?.[name]?name+'-error':undefined}/>{state.errors?.[name]&&<p className="field-error" id={name+'-error'}><T>{state.errors[name]?.[0]}</T></p>}</div>)}<p className="form-help"><T>The Driver receives an email invitation and chooses their own password. Access starts after setup.</T></p><button className="button button-dark" type="submit"><T>{pending?'Sending…':'Send Driver invitation'}</T></button></fieldset>{state.message&&<p role="status" className={state.success?'success-notice':'auth-error'}><T>{state.message}</T></p>}{!configured&&<p className="auth-error" role="alert"><T>Driver invitations are not configured. Contact your administrator.</T></p>}</form>;
}
export function ResendDriverInvite({id,configured}:{id:string;configured:boolean}){
  const [state,action,pending]=useActionState<DriverFormState,FormData>(resendDriverInvitation.bind(null,id),{});
  return <form action={action} className="driver-row-action"><button className="button signout-button" type="submit" disabled={!configured||pending}><T>{pending?'Sending…':'Resend invitation'}</T></button>{state.message&&<p role="status" className={state.success?'muted':'auth-error'}><T>{state.message}</T></p>}</form>;
}
export function DriverAccessForm({id,access}:{id:string;access:string}){
  const enable=access==='disabled';
  const [state,action,pending]=useActionState<DriverFormState,FormData>(changeDriverAccess.bind(null,id,access,enable),{});
  return <form action={action} className="driver-row-action">{!enable&&<label className="driver-disable-confirm"><Input type="checkbox" name="confirm" required disabled={pending}/><T>Confirm disabling access</T></label>}<button className="button signout-button" type="submit" disabled={pending}><T>{pending?'Saving…':enable?'Restore access':'Disable access'}</T></button>{state.message&&<p role="status" className={state.success?'muted':'auth-error'}><T>{state.message}</T></p>}</form>;
}
