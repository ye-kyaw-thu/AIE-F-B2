"use client";
import {T} from "@/components/i18n/language-provider";
import {Input,Textarea} from "@/components/i18n/fields";


import { useActionState } from "react";
import { useDraftSnapshot } from "@/lib/tracking/use-draft-snapshot";
import { manageShipment, changeGate, type AdminFormState } from "@/app/(authenticated)/admin/actions";
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, type ShipmentStatus, type GateStatus } from "@/types/domain";

export function ShipmentManagement(props: {
  id:string; updatedAt:string; status:ShipmentStatus; driverId:string|null; drivers:{id:string;full_name:string}[]; assignmentLocked:boolean;
}) {
  const {value:{id,updatedAt,status,driverId,drivers,assignmentLocked},capture}=useDraftSnapshot(props);
  const [state,action,pending] = useActionState<AdminFormState,FormData>(manageShipment,{});
  return <section className="panel"><div className="panel-heading"><h2><T>Manage shipment</T></h2></div><form key={updatedAt} action={action} className="shipment-form admin-management-form" onInputCapture={capture} onChangeCapture={capture} onClickCapture={capture} onSubmitCapture={capture}>
    <Input type="hidden" name="record_id" value={id} /><Input type="hidden" name="revision" value={updatedAt} />
    <fieldset disabled={pending}><legend><T>Driver assignment</T></legend>{assignmentLocked ? <p><T>Driver assignment is locked after pickup.</T></p> : <><div className="form-field"><label htmlFor="driver"><T>Assigned driver</T></label><select id="driver" name="driver" defaultValue={driverId ?? ""}><option value=""><T>Choose a driver</T></option>{drivers.map(driver=><option key={driver.id} value={driver.id}>{driver.full_name}</option>)}</select></div><button className="button signout-button" name="operation" value="assign" disabled={!drivers.length}><T>Save assignment</T></button></>}</fieldset>
    {status === "requested" ? <fieldset disabled={pending}><legend><T>Request approval</T></legend><p><T>Assign a driver before approving transport.</T></p><button className="button button-dark" name="operation" value="approve" disabled={!driverId}><T>Approve shipment</T></button></fieldset> : <fieldset disabled={pending}><legend><T>Status correction</T></legend><div className="form-grid"><div className="form-field"><label htmlFor="admin-status"><T>Correct status</T></label><select id="admin-status" name="status" defaultValue={status}>{SHIPMENT_STATUSES.filter(value=>value!=="requested").map(value=><option key={value} value={value}><T>{SHIPMENT_STATUS_LABELS[value]}</T></option>)}</select></div><div className="form-field"><label htmlFor="correction-note"><T>Reason for correction</T></label><Textarea id="correction-note" name="note" maxLength={1800} rows={3} /></div></div><button name="operation" value="status" className="button button-dark"><T>Update status</T></button></fieldset>}
    <div role="status" aria-live="polite"><T>{pending ? "Saving…" : state.message}</T></div>{state.message && <a href={`/admin/shipments/${id}`} className="text-link"><T>Reload latest shipment</T></a>}
  </form></section>;
}

export function GateForm(props: { id:string; updatedAt:string; status:GateStatus; reason:string }) {
  const {value:{id,updatedAt,status,reason},capture}=useDraftSnapshot(props);
  const [state,action,pending] = useActionState<AdminFormState,FormData>(changeGate,{});
  return <form key={updatedAt} action={action} className="shipment-form gate-management-form" onInputCapture={capture} onChangeCapture={capture} onClickCapture={capture} onSubmitCapture={capture}><Input type="hidden" name="record_id" value={id} /><Input type="hidden" name="revision" value={updatedAt} /><fieldset disabled={pending}><legend><T>Update gate condition</T></legend><div className="form-field"><label htmlFor={`${id}-status`}><T>Status</T></label><select id={`${id}-status`} name="status" defaultValue={status}><option value="open"><T>Open</T></option><option value="delayed"><T>Delayed</T></option><option value="closed"><T>Closed</T></option></select></div><div className="form-field"><label htmlFor={`${id}-reason`}><T>Reason / note</T></label><Textarea id={`${id}-reason`} name="reason" defaultValue={reason} maxLength={1000} rows={3} /><small><T>Required for Delayed or Closed.</T></small></div><button className="button button-dark" type="submit"><T>{pending ? "Saving…" : "Save gate status"}</T></button></fieldset><p role="status"><T>{state.message}</T></p>{state.message && <a href="/admin/gates" className="text-link"><T>Reload latest gates</T></a>}</form>;
}
