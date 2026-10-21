import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {loadEnvironment,printSafeError} from './lib/environment.mjs';
import {DEMO_PASSWORD} from './lib/demo-data.mjs';

const marker='Phase 7 automated verification';
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>nativeFetch(input,{...init,signal:init?.signal??AbortSignal.timeout(30000)});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function payload(html,match,fields){
  const form=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(row=>row[0]).find(value=>value.includes(match));
  assert.ok(form,`Expected ${match} form`);const data=new FormData();
  for(const tag of form.matchAll(/<input\b[^>]*>/g)){const name=tag[0].match(/\bname="([^"]+)"/)?.[1],value=tag[0].match(/\bvalue="([^"]*)"/)?.[1]??'';if(name)data.append(decode(name),decode(value));}
  assert.ok([...data.keys()].some(key=>key.startsWith('$ACTION_')));for(const [key,value]of Object.entries(fields))data.set(key,String(value));return data;
}
async function until(check,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(check())return;await delay(100);}assert.fail(`Timed out: ${label}`);}

async function main(){
  const {url,key,ref}=loadEnvironment(),token=process.env.SUPABASE_ACCESS_TOKEN;assert.ok(token,'Setup token required for isolated test cleanup.');
  const query=async(sql,parameters=[])=>{const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,parameters})});assert.ok(response.ok,`Fixture query failed (${response.status})`);return response.json();};
  const gateId=randomUUID(),gateName=`P7 ${gateId.slice(0,8)}`,sessions={},clients=[];let gateCreated=false;const shipmentIds=[];
  try{
    for(const role of ['admin','trader','trader2','driver']){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);const result=await client.auth.signInWithPassword({email:`${role}@demo.com`,password:DEMO_PASSWORD});assert.equal(result.error,null);sessions[role]={client,...result.data,events:[]};}
    await query('insert into public.gate_statuses(id,gate_name,location) values($1,$2,$3)',[gateId,gateName,'Temporary Phase 7 test gate']);gateCreated=true;
    for(const role of ['trader','trader2','driver']){const entry=sessions[role];await entry.client.realtime.setAuth(entry.session.access_token);const channel=entry.client.channel(`phase7:${role}:${randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'alerts'},event=>entry.events.push(event));entry.channel=channel;let status;channel.subscribe(value=>status=value);await until(()=>status==='SUBSCRIBED',`${role} alert subscription`);}
    const create=async role=>{const result=await sessions[role].client.rpc('create_shipment',{p_input:{origin:'Yangon',destination:'Muse',cargo_type:marker,cargo_description:'Temporary alert fixture',quantity:1,quantity_unit:'packages',pickup_date:new Date(Date.now()+86400000).toISOString().slice(0,10),route_gate_id:gateId,special_notes:''}});assert.equal(result.error,null);shipmentIds.push(result.data);return result.data;};
    const first=await create('trader'),second=await create('trader2'),admin=sessions.admin.client;
    const revision=async()=>{const row=await admin.from('gate_statuses').select('updated_at').eq('id',gateId).single();assert.equal(row.error,null);return row.data.updated_at;};
    const change=async(status,reason)=>{const result=await admin.rpc('change_gate_status',{p_id:gateId,p_expected_updated_at:await revision(),p_status:status,p_reason:reason});assert.equal(result.error,null);};
    await change('delayed',marker);
    for(const [role,id] of [['trader',first],['trader2',second]])await until(()=>sessions[role].events.some(event=>event.new.shipment_id===id),`${role} own gate alert`);
    await delay(800);assert.equal(sessions.driver.events.length,0);
    for(const [role,id]of [['trader',first],['trader2',second]]){const own=await sessions[role].client.from('alerts').select('*').eq('shipment_id',id);assert.equal(own.error,null);assert.equal(own.data.length,1);assert.equal(own.data[0].title,`${gateName} Gate Delayed`);assert.ok(own.data[0].message.includes(marker));}
    assert.equal((await sessions.trader.client.from('alerts').select('id').eq('shipment_id',second)).data.length,0);
    await change('delayed',`${marker} note edit`);for(const [role,id]of [['trader',first],['trader2',second]])assert.equal((await sessions[role].client.from('alerts').select('id').eq('shipment_id',id)).data.length,1);
    console.log('PASS: real gate transition creates one private alert per active shipment; note-only update does not duplicate it.');

    const broadcastTitle=`${marker} broadcast`;const sent=await admin.rpc('broadcast_alert',{p_title:broadcastTitle,p_message:'All traders receive this private operations notice.'});assert.equal(sent.error,null);assert.equal(sent.data,2);
    await until(()=>sessions.trader.events.some(event=>event.new.title===broadcastTitle)&&sessions.trader2.events.some(event=>event.new.title===broadcastTitle),'broadcast Realtime delivery');assert.equal(sessions.driver.events.length,0);
    const own=(await sessions.trader.client.from('alerts').select('*').eq('title',broadcastTitle).single()).data;assert.equal(own.is_read,false);
    assert.equal((await sessions.trader2.client.rpc('mark_alert_read',{p_id:own.id,p_is_read:true})).error?.code,'PT404');assert.equal((await admin.rpc('mark_alert_read',{p_id:own.id,p_is_read:true})).error?.code,'42501');
    assert.equal((await sessions.trader.client.rpc('mark_alert_read',{p_id:own.id,p_is_read:true})).error,null);assert.equal((await sessions.trader.client.from('alerts').select('is_read').eq('id',own.id).single()).data.is_read,true);
    console.log('PASS: Admin broadcast, Realtime delivery, recipient isolation and Trader-only read marker.');

    if(process.env.TEST_APP_URL){
      const origin=new URL(process.env.TEST_APP_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));const cookies={};
      for(const role of ['admin','trader']){const jar=new Map(),ssr=createServerClient(url,key,{auth:{autoRefreshToken:false},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});assert.equal((await ssr.auth.setSession(sessions[role].session)).error,null);cookies[role]=[...jar].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');}
      const get=async(path,role)=>{const response=await fetch(new URL(path,origin),{headers:{Cookie:cookies[role]},redirect:'manual'});assert.equal(response.status,200,path);return response.text();};
      const post=(path,role,body)=>fetch(new URL(path,origin),{method:'POST',headers:{Cookie:cookies[role],Origin:origin.origin},body,redirect:'manual'});
      const adminHtml=await get('/admin/alerts','admin');assert.ok(adminHtml.includes('Broadcast to all traders'));assert.ok(adminHtml.includes(broadcastTitle));
      const formTitle=`${marker} HTTP`;const broadcast=await post('/admin/alerts','admin',payload(adminHtml,'broadcast-form',{title:formTitle,message:'Submitted through the actual Admin Server Action.'}));assert.equal(broadcast.status,303);
      const traderHtml=await get('/trader/alerts','trader');assert.ok(traderHtml.includes(formTitle));assert.ok(traderHtml.includes(`${gateName} Gate Delayed`));assert.ok(traderHtml.includes('View shipment'));assert.match(traderHtml,/Mark(?:<!-- -->)?read/);
      const mark=await post('/trader/alerts','trader',payload(traderHtml,'alert-read-form',{}));assert.equal(mark.status,303);assert.ok((await get('/trader/dashboard','trader')).includes('Recent alerts'));
      console.log('PASS: actual Admin broadcast and Trader read-marker forms, alert pages, navigation and dashboard summary.');
    }
  }finally{
    for(const entry of Object.values(sessions))await entry.client.removeAllChannels();
    if(shipmentIds.length)await query('delete from public.shipments where id=any($1::uuid[]) and cargo_type=$2',[shipmentIds,marker]);
    await query("delete from public.alerts where shipment_id is null and title like $1",[`${marker}%`]);
    if(gateCreated)await query('delete from public.gate_statuses where id=$1 and gate_name=$2',[gateId,gateName]);
    for(const client of clients)await client.auth.signOut({scope:'local'});
    console.log('Removed only temporary Phase 7 shipments, gate and broadcasts.');
  }
}
main().catch(printSafeError);
