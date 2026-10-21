
import {T} from "@/components/i18n/language-provider";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/shipments/queries";

export async function ShipmentDocuments({shipment}:{shipment:string}) {
  await requireProfile();const supabase=await createClient();
  const {data,error}=await supabase.from("documents").select("id,original_name,document_type,size_bytes,created_at").eq("shipment_id",shipment).order("created_at",{ascending:false}).limit(50);
  return <section className="panel"><div className="panel-heading"><h2><T>Shipment evidence</T></h2><span className="neutral-chip"><T>Private · Latest 50</T></span></div>{error ? <p className="dashboard-message" role="alert"><T>Could not load evidence. Refresh to retry.</T></p> : !data.length ? <p className="dashboard-message"><T>No evidence uploaded yet.</T></p> : <ul className="document-list">{data.map(file=><li key={file.id}><div><a className="text-link" href={`/documents/${file.id}/download`}>{file.original_name}</a><small><T>{file.document_type.replaceAll("_"," ")}</T> · {(file.size_bytes/1024).toFixed(1)} KiB · {formatDate(file.created_at,true)}</small></div><span><T>Download ↓</T></span></li>)}</ul>}</section>;
}
