import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {loadEnvironment,printSafeError} from './lib/environment.mjs';
import {DEMO_PASSWORD} from './lib/demo-data.mjs';

const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>nativeFetch(input,{...init,signal:init?.signal??AbortSignal.timeout(30000)});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const marker='Phase 6 automated verification';
async function until(check,label,timeout=20000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) {if(check())return;await delay(100);}
  assert.fail(`Timed out: ${label}`);
}
async function main() {
  const {url,key,ref}=loadEnvironment();const token=process.env.SUPABASE_ACCESS_TOKEN;
  assert.ok(token,'Setup token required for isolated test fixtures.');
  const query=async(sql,parameters=[])=>{
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,parameters})});
    assert.ok(response.ok,`Fixture query failed (${response.status})`);return response.json();
  };
  const sessions={};const gateId=randomUUID(),gateName=`${marker} ${gateId}`;let shipmentId,traderId,gateCreated=false;
  const subscribe=async(role,allowDenied=false)=>{
    const entry=sessions[role];
    if(entry.session)await entry.client.realtime.setAuth(entry.session.access_token);
    const channel=entry.client.channel(`phase6-test:${role}:${randomUUID()}`);entry.channel=channel;entry.joins=0;entry.status='CONNECTING';
    for(const table of ['shipments','shipment_updates','gate_statuses','documents','alerts']) {
      // Intentionally no client filter: the database must enforce isolation.
      channel.on('postgres_changes',{event:'*',schema:'public',table},payload=>entry.events.push(payload));
    }
    channel.subscribe(status=>{entry.status=status;if(status==='SUBSCRIBED')entry.joins++;});
    await until(()=>entry.status==='SUBSCRIBED'||(allowDenied&&['CHANNEL_ERROR','TIMED_OUT'].includes(entry.status)),`${role} subscription`);
  };
  const received=(role,table,id)=>sessions[role].events.some(event=>event.table===table&&event.new?.id===id);
  const expect=async(roles,table,id)=>{for(const role of roles)await until(()=>received(role,table,id),`${role} receives ${table}`);};
  try {
    for(const role of ['admin','trader','driver','trader2','driver2','anonymous']) {
      const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});sessions[role]={client,events:[]};
      if(role!=='anonymous') {const result=await client.auth.signInWithPassword({email:`${role}@demo.com`,password:DEMO_PASSWORD});assert.equal(result.error,null);Object.assign(sessions[role],result.data);}
    }
    const admin=sessions.admin.client,trader=sessions.trader.client,driver=sessions.driver.client;traderId=sessions.trader.user.id;
    await query('insert into public.gate_statuses(id,gate_name,location) values($1,$2,$3)',[gateId,gateName,'Temporary test gate']);gateCreated=true;
    for(const role of Object.keys(sessions))await subscribe(role,role==='anonymous');
    const created=await trader.rpc('create_shipment',{p_input:{origin:'Yangon',destination:'Muse',cargo_type:marker,cargo_description:'Temporary live tracking test',quantity:1,quantity_unit:'packages',pickup_date:new Date(Date.now()+86400000).toISOString().slice(0,10),route_gate_id:gateId,special_notes:''}});
    assert.equal(created.error,null);shipmentId=created.data;
    await expect(['admin','trader'],'shipments',shipmentId);
    const read=async(client=admin)=>{const result=await client.from('shipments').select('*').eq('id',shipmentId).single();assert.equal(result.error,null);return result.data;};
    const manage=async(action,driverId=sessions.driver.user.id)=>{const result=await admin.rpc('manage_shipment',{p_id:shipmentId,p_expected_updated_at:(await read()).updated_at,p_action:action,p_driver_id:driverId,p_status:'approved',p_note:''});assert.equal(result.error,null);};
    await manage('assign');await expect(['driver'],'shipments',shipmentId);
    await manage('approve');
    const update=async(note,latitude=21.9588)=>{
      const id=randomUUID();const result=await driver.rpc('append_driver_update',{p_id:id,p_shipment_id:shipmentId,p_expected_updated_at:(await read()).updated_at,p_status:'in_transit',p_note:note,p_latitude:latitude,p_longitude:96.0891,p_occurred_at:new Date().toISOString()});assert.equal(result.error,null);return id;
    };
    const first=await update('Realtime GPS checkpoint');
    await expect(['admin','trader','driver'],'shipment_updates',first);
    for(const role of ['admin','trader','driver'])await until(()=>sessions[role].events.some(event=>event.table==='shipments'&&event.new?.id===shipmentId&&event.new.current_lat===21.9588),`${role} receives GPS`);
    await delay(1500);
    for(const role of ['trader2','driver2','anonymous'])assert.equal(sessions[role].events.some(event=>event.new?.id===shipmentId||event.new?.shipment_id===shipmentId),false,`${role} must not receive foreign shipment data`);
    console.log('PASS: actual WebSocket INSERT/UPDATE delivery, status/GPS and timeline events; foreign and anonymous isolation.');

    const documentId=randomUUID(),alertId=randomUUID();
    // These are metadata-only fixtures for subscription authorization, not a
    // Storage upload or Phase 7 alert-generation implementation.
    await query("insert into public.documents(id,shipment_id,driver_id,document_type,file_url,original_name,mime_type,size_bytes) values($1,$2,$3,'photo',$4,'phase6-fixture.png','image/png',1)",[documentId,shipmentId,sessions.driver.user.id,`${shipmentId}/${sessions.driver.user.id}/${documentId}.png`]);
    await query('insert into public.alerts(id,trader_id,shipment_id,title,message) values($1,$2,$3,$4,$4)',[alertId,traderId,shipmentId,marker]);
    await expect(['admin','trader','driver'],'documents',documentId);await expect(['admin','trader'],'alerts',alertId);
    const gate=(await admin.from('gate_statuses').select('updated_at').eq('id',gateId).single()).data;
    assert.equal((await admin.rpc('change_gate_status',{p_id:gateId,p_expected_updated_at:gate.updated_at,p_status:'delayed',p_reason:marker})).error,null);
    await expect(['admin','trader','driver','trader2','driver2'],'gate_statuses',gateId);
    await delay(1500);
    for(const role of ['trader2','driver2','anonymous'])assert.equal(received(role,'documents',documentId)||received(role,'alerts',alertId),false);
    assert.equal(received('driver','alerts',alertId),false);assert.equal(received('anonymous','gate_statuses',gateId),false);
    console.log('PASS: evidence and alert metadata obey RLS; gate changes reach authenticated roles only.');

    const owner=sessions.trader,joins=owner.joins;
    await owner.client.realtime.disconnect();
    const missed=await update('Saved while Trader disconnected',22.1);
    await expect(['admin','driver'],'shipment_updates',missed);
    assert.equal(received('trader','shipment_updates',missed),false);
    owner.client.realtime.connect();
    await until(()=>owner.joins>joins,'Trader reconnects and rejoins');
    assert.equal((await read(trader)).current_lat,22.1,'Reconnect refetch catches missed position');
    const resumed=await update('Saved after Trader reconnected',22.2);await expect(['trader'],'shipment_updates',resumed);
    const timeline=await trader.rpc('shipment_milestones',{p_shipment_id:shipmentId});assert.equal(timeline.error,null);assert.ok(timeline.data.some(row=>row.status==='requested'));assert.ok(timeline.data.some(row=>row.status==='in_transit'));assert.equal(timeline.data.some(row=>row.status==='picked_up'),false);
    for(const role of ['trader2','driver2'])assert.equal((await sessions[role].client.rpc('shipment_milestones',{p_shipment_id:shipmentId})).error?.code,'42501');
    console.log('PASS: socket reconnect/rejoin, missed-position refetch, resumed delivery and authorized milestone aggregation.');

    if(process.env.TEST_APP_URL) {
      const origin=new URL(process.env.TEST_APP_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
      for(const role of ['trader','admin','driver']) {
        const jar=new Map();const ssr=createServerClient(url,key,{auth:{autoRefreshToken:false},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
        assert.equal((await ssr.auth.setSession(sessions[role].session)).error,null);
        const cookie=[...jar].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');
        const response=await fetch(new URL(`/${role}/shipments/${shipmentId}`,origin),{headers:{Cookie:cookie},redirect:'manual'});assert.equal(response.status,200);const html=await response.text();
        for(const text of ['Shipment progress','Reload latest','Current status','No milestone recorded','22.20000','Saved after Trader reconnected'])assert.ok(html.includes(text),`${role} page includes ${text}`);
      }
      console.log('PASS: production HTTP pages for all three roles include current GPS, timeline, history and live controls.');
    }
    await owner.client.removeAllChannels();await owner.client.auth.signOut({scope:'local'});assert.equal(owner.client.getChannels().length,0);
    const afterLogout=await update('After Trader unsubscribe/logout',22.3);await expect(['admin','driver'],'shipment_updates',afterLogout);await delay(1000);assert.equal(received('trader','shipment_updates',afterLogout),false);
    console.log('PASS: explicit subscription teardown and logout stop delivery.');
  } finally {
    for(const entry of Object.values(sessions)) {await entry.client.removeAllChannels();await entry.client.auth.signOut({scope:'local'});}
    if(shipmentId)assert.equal((await query('delete from public.shipments where id=$1 and trader_id=$2 and cargo_type=$3 returning id',[shipmentId,traderId,marker])).length,1);
    if(gateCreated)assert.equal((await query('delete from public.gate_statuses where id=$1 and gate_name=$2 returning id',[gateId,gateName])).length,1);
    console.log('Removed only temporary Phase 6 fixtures.');
  }
}
main().catch(printSafeError);
