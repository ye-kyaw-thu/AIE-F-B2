import { z } from "zod";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  await requireProfile();const {id}=await params;const headers={"Cache-Control":"private, no-store"};
  if(!z.uuid().safeParse(id).success) return new Response("Document not found",{status:404,headers});
  const supabase=await createClient();const {data,error}=await supabase.from("documents").select("file_url,original_name").eq("id",id).maybeSingle();
  if(error) return new Response("Evidence unavailable. Please retry.",{status:503,headers});
  if(!data) return new Response("Document not found",{status:404,headers});
  const signed=await supabase.storage.from("shipment-documents").createSignedUrl(data.file_url,60,{download:data.original_name});
  if(signed.error) return new Response("Download unavailable. Please retry.",{status:503,headers});
  return new Response(null,{status:302,headers:{...headers,Location:signed.data.signedUrl}});
}
