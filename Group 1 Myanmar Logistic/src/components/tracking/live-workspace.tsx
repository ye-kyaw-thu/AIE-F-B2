"use client";
import {T} from "@/components/i18n/language-provider";


import { useEffect,useRef,useState,useTransition } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createRefreshScheduler } from "@/lib/tracking/refresh-scheduler.mjs";
import type { UserRole } from "@/types/domain";

type Connection="connecting"|"live"|"reconnecting"|"offline";
type Props={userId:string;role:UserRole;children:React.ReactNode};
export function LiveWorkspace(props:Props) {
  const pathname=usePathname(),search=useSearchParams(),router=useRouter();
  return <LivePage key={`${props.userId}:${router.bfcacheId}:${pathname}?${search.toString()}`} {...props} />;
}
function LivePage({userId,role,children}:Props) {
  const router=useRouter();const [connection,setConnection]=useState<Connection>("connecting");
  const [editing,setEditing]=useState(false),[signedOut,setSignedOut]=useState(false);
  const [refreshing,startTransition]=useTransition();
  const editingRef=useRef(false),refreshingRef=useRef(false);
  const schedulerRef=useRef<ReturnType<typeof createRefreshScheduler>|null>(null);
  useEffect(()=>{refreshingRef.current=refreshing;if(!refreshing)schedulerRef.current?.flush();},[refreshing]);
  useEffect(()=>{
    const client=createClient();let disposed=false,starting=false,subscribed=false;
    const channel=client.channel(`logistics:${userId}:${crypto.randomUUID()}`);
    const scheduler=createRefreshScheduler({
      canRefresh:()=>!disposed&&!editingRef.current&&!refreshingRef.current&&navigator.onLine&&document.visibilityState==="visible",
      refresh:()=>{refreshingRef.current=true;startTransition(()=>router.refresh());},
    });schedulerRef.current=scheduler;
    const changed=()=>scheduler.request();
    const shipmentFilter=role==="admin" ? {} : {filter:`${role==="trader"?"trader_id":"driver_id"}=eq.${userId}`};
    for(const event of ["INSERT","UPDATE"] as const) {
      channel.on("postgres_changes",{event,schema:"public",table:"shipments",...shipmentFilter},changed);
      for(const table of ["shipment_updates","gate_statuses","documents","alerts"]) channel.on("postgres_changes",{event,schema:"public",table},changed);
    }
    const endSession=()=>{
      disposed=true;scheduler.dispose();void client.removeChannel(channel);setSignedOut(true);
      window.location.replace("/login");
    };
    const auth=client.auth.onAuthStateChange((event,session)=>{
      if(!disposed&&(event==="SIGNED_OUT"||(session&&session.user.id!==userId)))endSession();
      // supabase-js propagates refreshed session tokens to Realtime itself.
    });
    const connect=async()=>{
      if(disposed||starting||subscribed)return;
      if(!navigator.onLine){setConnection("offline");return;}
      starting=true;
      try {
      const {data,error}=await client.auth.getSession();
      if(disposed)return;
      if(error)throw error;
      if(!data.session||data.session.user.id!==userId){endSession();return;}
      await client.realtime.setAuth(data.session.access_token);
      if(disposed)return;
      subscribed=true;
      if(!navigator.onLine)setConnection("offline");
      channel.subscribe(status=>{
        if(disposed)return;
        if(status==="SUBSCRIBED"){setConnection(navigator.onLine?"live":"offline");scheduler.request();}
        else setConnection(navigator.onLine?"reconnecting":"offline");
      });
      } catch {if(!disposed)setConnection(navigator.onLine?"reconnecting":"offline");}
      finally {starting=false;}
    };
    void connect();
    client.realtime.onHeartbeat(status=>{
      if(disposed)return;
      if(status==="ok"&&channel.state==="joined")setConnection(navigator.onLine?"live":"offline");
      else if(status==="timeout"||status==="error")setConnection(navigator.onLine?"reconnecting":"offline");
    });
    const offline=()=>setConnection("offline");
    const resume=()=>{if(disposed||!navigator.onLine)return;if(subscribed)client.realtime.connect();else void connect();scheduler.request();};
    const online=()=>{setConnection("reconnecting");resume();};
    const visible=()=>{if(document.visibilityState==="visible")resume();};
    window.addEventListener("offline",offline);window.addEventListener("online",online);document.addEventListener("visibilitychange",visible);
    // RLS can suppress a reassignment event for the old driver. Reconcile reads
    // periodically as well as after reconnect to remove stale authorized views.
    const reconcile=window.setInterval(()=>scheduler.request(),30000);
    const retry=window.setInterval(()=>{if(!subscribed)void connect();},5000);
    return ()=>{disposed=true;scheduler.dispose();schedulerRef.current=null;clearInterval(reconcile);clearInterval(retry);auth.data.subscription.unsubscribe();client.realtime.onHeartbeat(()=>{});void client.removeChannel(channel);window.removeEventListener("offline",offline);window.removeEventListener("online",online);document.removeEventListener("visibilitychange",visible);};
  },[userId,role,router]);
  const markEditing=(event:React.SyntheticEvent)=>{
    const element=event.target;
    if(element instanceof Element&&element.closest("form.shipment-form")){editingRef.current=true;setEditing(true);}
  };
  const label={connecting:"Connecting",live:"Live",reconnecting:"Reconnecting",offline:"Offline"}[connection];
  if(signedOut)return <p className="dashboard-message"><T>Session ended. Opening sign in…</T></p>;
  return <div className={`live-workspace live-role-${role}`} onInputCapture={markEditing} onChangeCapture={markEditing} onClickCapture={markEditing} onSubmitCapture={markEditing}>
    <div className={`live-banner live-${connection}`} role="status" aria-live="polite"><span className="live-dot" aria-hidden="true" /><strong><T>{label}</T></strong><span><T>{editing ? "Automatic refresh paused while editing. Reload when ready to load the latest data." : connection==="offline" ? "Showing previously loaded data. Updates resume when connected." : connection==="reconnecting" ? "Restoring live updates. Data is also checked every 30 seconds." : refreshing ? "Updating shipment data…" : "Shipment changes appear automatically."}</T></span><button className="button signout-button" type="button" onClick={()=>window.location.reload()} disabled={connection==="offline"}><T>Reload latest</T></button></div>
    {children}
  </div>;
}
