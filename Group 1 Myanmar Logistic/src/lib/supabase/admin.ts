import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseConfig} from "./config";

export function invitationsConfigured(){return !!process.env.SUPABASE_SECRET_KEY?.trim();}
/** Only called after a verified Admin guard. Never share this client with SSR cookies. */
export function createAuthAdminClient(){
  const key=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!key)throw new Error("Driver invitations are not configured. Contact your administrator.");
  return createClient(getSupabaseConfig().url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})},
  });
}
