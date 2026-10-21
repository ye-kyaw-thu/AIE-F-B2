"use client";
import {T} from "@/components/i18n/language-provider";
import {Input} from "@/components/i18n/fields";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EvidenceUpload({shipment,driver}:{shipment:string;driver:string}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
  async function upload(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy) return;const form=event.currentTarget;const fields=new FormData(form);const file=fields.get("evidence");
    if(!(file instanceof File)||file.size===0||file.size>10485760||file.name.trim().length>255) {setMessage("Choose a JPEG, PNG or PDF file between 1 byte and 10 MiB, with a filename up to 255 characters.");return;}
    setBusy(true);setMessage("Uploading evidence…");const client=createClient();let path:string|undefined;
    try {
      const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
      const kind=bytes[0]===255&&bytes[1]===216&&bytes[2]===255 ? {mime:"image/jpeg",ext:"jpg"} : [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value) ? {mime:"image/png",ext:"png"} : new TextDecoder().decode(bytes.slice(0,5))==="%PDF-" ? {mime:"application/pdf",ext:"pdf"} : null;
      if(!kind) {setMessage("The file contents are not recognized as JPEG, PNG or PDF.");return;}
      const id=crypto.randomUUID();path=`${shipment}/${driver}/${id}.${kind.ext}`;
      const stored=await client.storage.from("shipment-documents").upload(path,file,{contentType:kind.mime,upsert:false});
      if(stored.error) {setMessage("Upload failed. Check your connection and shipment assignment, then try again.");return;}
      const result=await client.rpc("register_shipment_document",{p_id:id,p_shipment_id:shipment,p_document_type:String(fields.get("document_type")),p_original_name:file.name,p_mime_type:kind.mime,p_size_bytes:file.size,p_extension:kind.ext});
      if(result.error) {
        const removed=await client.storage.from("shipment-documents").remove([path]);
        setMessage(removed.error ? "Evidence registration failed and cleanup could not finish. Reload the evidence list before retrying." : "Evidence could not be registered. Reload the shipment and check your assignment before retrying.");return;
      }
      path=undefined;setMessage("Evidence uploaded successfully.");form.reset();router.refresh();
    } catch {
      // Cleanup policy permits removal only while no committed document references the path.
      if(path) {try {await client.storage.from("shipment-documents").remove([path]);} catch { /* Connection may still be unavailable. */ }}
      setMessage("Connection interrupted. Reload the evidence list to check whether the file was saved before uploading again.");
    } finally {setBusy(false);}
  }
  return <section className="panel"><div className="panel-heading"><h2><T>Upload evidence</T></h2></div><form onSubmit={upload} className="shipment-form evidence-upload-form"><fieldset disabled={busy}><legend><T>Shipment evidence</T></legend><div className="form-field"><label htmlFor="document-type"><T>Evidence type</T></label><select id="document-type" name="document_type"><option value="photo"><T>Photo</T></option><option value="delivery_receipt"><T>Delivery receipt</T></option><option value="customs"><T>Customs document</T></option><option value="other"><T>Other</T></option></select></div><div className="form-field"><label htmlFor="evidence"><T>Photo or document</T></label><Input id="evidence" name="evidence" type="file" accept="image/jpeg,image/png,application/pdf" required /><small><T>JPEG, PNG or PDF · Maximum 10 MiB · Internet required</T></small></div><button className="button button-dark" type="submit"><T>{busy ? "Uploading…" : "Upload evidence"}</T></button></fieldset><p role="status"><T>{message}</T></p><noscript><T>Enable JavaScript to upload files.</T></noscript></form></section>;
}
