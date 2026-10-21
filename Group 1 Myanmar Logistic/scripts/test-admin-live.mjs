import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { loadEnvironment, printSafeError } from './lib/environment.mjs';
import { DEMO_PASSWORD } from './lib/demo-data.mjs';

const marker='Phase 4 automated verification';
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>nativeFetch(input,{...init,signal:init?.signal ?? AbortSignal.timeout(25000)});
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function payload(html,match,fields) {
  const form=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(result=>result[0]).find(value=>value.includes(match));
  assert.ok(form,'Expected management form');const data=new FormData();
  for(const tag of form.matchAll(/<input\b[^>]*>/g)) {
    if(!tag[0].includes('type="hidden"')) continue;
    const name=tag[0].match(/\bname="([^"]+)"/)?.[1],value=tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? '';
    if(name) data.append(decode(name),decode(value));
  }
  assert.ok([...data.keys()].some(key=>key.startsWith('$ACTION_')));
  for(const [key,value] of Object.entries(fields)) data.set(key,String(value));return data;
}
async function main() {
  const {url,key,ref}=loadEnvironment();const token=process.env.SUPABASE_ACCESS_TOKEN;
  assert.ok(token,'Setup token is required for temporary fixtures and cleanup.');
  const gateId=randomUUID(), gateName=`${marker} ${gateId}`;
  const clients=[],sessions={};let shipmentId,traderId,gateCreated=false;
  const query=async(sql,parameters=[])=>{
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,parameters})});
    assert.ok(response.ok,`Fixture query failed (${response.status})`);return response.json();
  };
  try {
    for(const role of ['admin','trader','driver','driver2','trader2']) {
      const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);
      const {data,error}=await client.auth.signInWithPassword({email:`${role}@demo.com`,password:DEMO_PASSWORD});
      assert.equal(error,null,`Login: ${role}`);sessions[role]={client,...data};
    }
    const admin=sessions.admin.client,trader=sessions.trader.client;traderId=sessions.trader.user.id;
    console.log('Authenticated all five accounts; preparing temporary fixtures.');
    await query("insert into public.gate_statuses(id,gate_name,location) values($1,$2,'Temporary test gate')",[gateId,gateName]);gateCreated=true;
    const created=await trader.rpc('create_shipment',{p_input:{origin:'Yangon',destination:'Muse',cargo_type:marker,cargo_description:'Temporary test shipment',quantity:2,quantity_unit:'tonnes',pickup_date:new Date(Date.now()+86400000).toISOString().slice(0,10),route_gate_id:gateId,special_notes:''}});
    assert.equal(created.error,null);shipmentId=created.data;
    const read=async()=>{const result=await admin.from('shipments').select('*').eq('id',shipmentId).single();assert.equal(result.error,null);return result.data;};
    const rpc=async(action,fields={},client=admin)=>client.rpc('manage_shipment',{p_id:shipmentId,p_expected_updated_at:(await read()).updated_at,p_action:action,p_driver_id:sessions.driver.user.id,p_status:'approved',p_note:'',...fields});
    assert.equal((await rpc('approve')).error?.code,'PT422');
    for(const role of ['trader','driver']) assert.equal((await rpc('assign',{},sessions[role].client)).error?.code,'42501');
    assert.equal((await rpc('assign',{p_driver_id:traderId})).error?.code,'22023');
    console.log('PASS: unassigned approval, unauthorized actions and invalid driver rejection.');
    const origin=process.env.TEST_APP_URL ? new URL(process.env.TEST_APP_URL) : null;
    let cookie,get,post;
    if(origin) {
      assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
      const jar=new Map();const ssr=createServerClient(url,key,{auth:{autoRefreshToken:false},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
      assert.equal((await ssr.auth.setSession(sessions.admin.session)).error,null);
      cookie=[...jar].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');
      get=async path=>{const response=await fetch(new URL(path,origin),{headers:{Cookie:cookie},redirect:'manual'});assert.equal(response.status,200,path);return response.text();};
      post=(path,body)=>fetch(new URL(path,origin),{method:'POST',headers:{Cookie:cookie,Origin:origin.origin},body,redirect:'manual'});
      for(const path of ['/admin/dashboard','/admin/shipments','/admin/shipments?status=requested','/admin/gates']) { assert.ok(!(await get(path)).includes('NEXT_REDIRECT'));console.log(`PASS: ${path}`); }
    }
    const path=`/admin/shipments/${shipmentId}`;
    const initial=await read();
    if(origin) {
      const html=await get(path);assert.ok(html.includes('Interactive shipment map'));assert.ok(html.includes('No truck location reported yet.'));
      const assigned=await post(path,payload(html,'admin-management-form',{operation:'assign',driver:sessions.driver.user.id}));assert.equal(assigned.status,303);
      console.log('PASS: assignment form saved.');
      const stale=await post(path,payload(html,'admin-management-form',{operation:'assign',driver:sessions.driver2.user.id}));console.log(`Stale form response: HTTP ${stale.status}`);assert.equal(stale.status,200);assert.ok((await stale.text()).includes('This record changed'));
      console.log('PASS: stale form response.');
    } else assert.equal((await rpc('assign')).error,null);
    assert.equal((await read()).driver_id,sessions.driver.user.id);
    assert.equal((await rpc('assign',{p_expected_updated_at:initial.updated_at,p_driver_id:sessions.driver2.user.id})).error?.code,'PT409');
    console.log('PASS: stale API response.');
    for(const [role,expected] of [['driver',1],['driver2',0],['trader2',0]]) {
      const result=await sessions[role].client.from('shipments').select('id').eq('id',shipmentId);assert.equal(result.error,null);assert.equal(result.data.length,expected);
    }
    if(origin) assert.equal((await post(path,payload(await get(path),'admin-management-form',{operation:'approve'}))).status,303);
    else assert.equal((await rpc('approve')).error,null);
    assert.equal((await read()).status,'approved');
    console.log('PASS: approval saved.');
    assert.equal((await trader.rpc('edit_requested_shipment',{p_shipment_id:shipmentId,p_expected_updated_at:(await read()).updated_at,p_input:{}})).error?.code,'PT422');
    if(origin) {
      const html=await get(path);
      const invalid=await post(path,payload(html,'admin-management-form',{operation:'status',status:'in_transit',note:''}));assert.equal(invalid.status,200);assert.ok((await invalid.text()).includes('Enter a reason'));
      assert.equal((await post(path,payload(html,'admin-management-form',{operation:'status',status:'in_transit',note:'Demo departure confirmed.'}))).status,303);
      assert.ok((await get(path)).includes('Driver assignment is locked after pickup'));
    } else assert.equal((await rpc('status',{p_status:'in_transit',p_note:'Demo departure confirmed.'})).error,null);
    assert.equal((await read()).status,'in_transit');assert.equal((await rpc('assign',{p_driver_id:sessions.driver2.user.id})).error?.code,'PT422');
    const history=await admin.from('shipment_updates').select('id,actor_id,note').eq('shipment_id',shipmentId);assert.equal(history.error,null);assert.equal(history.data.length,4);
    assert.equal(history.data.filter(event=>event.actor_id===sessions.admin.user.id).length,3);
    console.log('PASS: assignment, approval, correction, audit history, stale conflicts and trader/driver isolation.');

    const gateRow=await admin.from('gate_statuses').select('updated_at').eq('id',gateId).single();assert.equal(gateRow.error,null);
    const gateArgs={p_id:gateId,p_expected_updated_at:gateRow.data.updated_at,p_status:'closed',p_reason:'Demo closure'};
    assert.equal((await trader.rpc('change_gate_status',gateArgs)).error?.code,'42501');
    assert.equal((await admin.rpc('change_gate_status',{...gateArgs,p_reason:''})).error?.code,'22023');
    if(origin) {
      const html=await get('/admin/gates');
      const invalid=await post('/admin/gates',payload(html,`${gateId}-status`,{status:'closed',reason:''}));assert.equal(invalid.status,200);assert.ok((await invalid.text()).includes('Enter a reason'));
      assert.equal((await post('/admin/gates',payload(html,`${gateId}-status`,{status:'closed',reason:'Demo closure'}))).status,303);
      assert.ok((await get(path)).includes('Demo closure'));
    } else assert.equal((await admin.rpc('change_gate_status',gateArgs)).error,null);
    const gateAfter=await trader.from('gate_statuses').select('status,reason,updated_by').eq('id',gateId).single();assert.equal(gateAfter.error,null);assert.equal(gateAfter.data.status,'closed');assert.equal(gateAfter.data.updated_by,sessions.admin.user.id);
    assert.equal((await admin.rpc('change_gate_status',{...gateArgs,p_status:'open'})).error?.code,'PT409');
    console.log('PASS: gate validation, admin authorization, trader visibility and stale gate conflict.');
    if(origin) console.log('PASS: actual Admin assignment/approval/correction/gate forms, validation feedback and shipment map server rendering.');
  } finally {
    if(shipmentId) assert.equal((await query('delete from public.shipments where id=$1 and trader_id=$2 and cargo_type=$3 returning id',[shipmentId,traderId,marker])).length,1);
    if(gateCreated) assert.equal((await query('delete from public.gate_statuses where id=$1 and gate_name=$2 returning id',[gateId,gateName])).length,1);
    for(const client of clients) await client.auth.signOut({scope:'local'});
    console.log('Removed temporary Phase 4 shipment, events and gate. Existing demo records were preserved.');
  }
}
main().catch(printSafeError);
