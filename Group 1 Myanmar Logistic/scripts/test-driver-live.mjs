import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {loadEnvironment,printSafeError} from './lib/environment.mjs';
import {DEMO_PASSWORD,museId} from './lib/demo-data.mjs';

const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>nativeFetch(input,{...init,signal:init?.signal ?? AbortSignal.timeout(30000)});
const marker='Phase 5 automated verification';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function payload(html,fields) {
  const form=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(value=>value[0]).find(value=>value.includes('driver-update-form'));assert.ok(form,'Expected Driver update form');const data=new FormData();
  for(const tag of form.matchAll(/<input\b[^>]*>/g)) {if(!tag[0].includes('type="hidden"')) continue;const name=tag[0].match(/\bname="([^"]+)"/)?.[1],value=tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? '';if(name)data.append(decode(name),decode(value));}
  assert.ok([...data.keys()].some(key=>key.startsWith('$ACTION_')));for(const [key,value] of Object.entries(fields))data.set(key,String(value));return data;
}
async function main() {
  const {url,key,ref}=loadEnvironment();const token=process.env.SUPABASE_ACCESS_TOKEN;assert.ok(token,'Setup token required for isolated test cleanup.');
  const management=async(path,body)=>{const response=await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(response.ok,`Fixture management failed (${response.status})`);return response.json();};
  const keys=await management('/api-keys?reveal=true');const elevated=keys.find(item=>item.type==='secret'&&item.api_key?.startsWith('sb_secret_'))??keys.find(item=>item.name==='service_role'&&item.api_key);assert.ok(elevated,'Setup key unavailable');
  const cleanupClient=createClient(url,elevated.api_key,{auth:{persistSession:false,autoRefreshToken:false}});
  const sessions={},clients=[],objectPaths=[];let shipmentId,traderId;
  try {
    for(const role of ['admin','trader','driver','driver2','trader2']) {const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);const {data,error}=await client.auth.signInWithPassword({email:`${role}@demo.com`,password:DEMO_PASSWORD});assert.equal(error,null);sessions[role]={client,...data};}
    const admin=sessions.admin.client,driver=sessions.driver.client,trader=sessions.trader.client;traderId=sessions.trader.user.id;
    const created=await trader.rpc('create_shipment',{p_input:{origin:'Yangon',destination:'Muse',cargo_type:marker,cargo_description:'Temporary driver workflow fixture',quantity:1,quantity_unit:'packages',pickup_date:new Date(Date.now()+86400000).toISOString().slice(0,10),route_gate_id:museId,special_notes:''}});assert.equal(created.error,null);shipmentId=created.data;
    const read=async()=>{const result=await admin.from('shipments').select('*').eq('id',shipmentId).single();assert.equal(result.error,null);return result.data;};
    const manage=async(action)=>{const result=await admin.rpc('manage_shipment',{p_id:shipmentId,p_expected_updated_at:(await read()).updated_at,p_action:action,p_driver_id:sessions.driver.user.id,p_status:'approved',p_note:''});assert.equal(result.error,null);};
    await manage('assign');
    const updateArgs=async(fields={})=>({p_id:randomUUID(),p_shipment_id:shipmentId,p_expected_updated_at:(await read()).updated_at,p_status:'picked_up',p_note:'Cargo collected',p_latitude:16.8409,p_longitude:96.1735,p_occurred_at:new Date().toISOString(),...fields});
    assert.equal((await driver.rpc('append_driver_update',await updateArgs())).error?.code,'PT422');await manage('approve');
    for(const role of ['admin','trader','driver2']) assert.equal((await sessions[role].client.rpc('append_driver_update',await updateArgs())).error?.code,'42501');
    const first=await updateArgs();assert.equal((await driver.rpc('append_driver_update',first)).error,null);assert.equal((await driver.rpc('append_driver_update',first)).error,null);
    assert.equal((await driver.rpc('append_driver_update',{...first,p_note:'Conflicting retry'})).error?.code,'PT409');
    assert.equal((await read()).current_lat,16.8409);assert.equal((await read()).status,'picked_up');
    assert.equal((await admin.from('shipment_updates').select('id').eq('id',first.p_id)).data.length,1);
    console.log('PASS: Driver role/assignment checks, approval requirement, atomic GPS/progress and idempotent retries.');

    const documentId=randomUUID(),objectPath=`${shipmentId}/${sessions.driver.user.id}/${documentId}.png`;objectPaths.push(objectPath);
    assert.ok((await sessions.driver2.client.storage.from('shipment-documents').upload(objectPath,png,{contentType:'image/png'})).error);
    assert.equal((await driver.storage.from('shipment-documents').upload(objectPath,png,{contentType:'image/png',upsert:false})).error,null,'Assigned Driver upload failed');
    const args={p_id:documentId,p_shipment_id:shipmentId,p_document_type:'photo',p_original_name:'phase-5-test.png',p_mime_type:'image/png',p_size_bytes:png.length,p_extension:'png'};
    assert.equal((await driver.rpc('register_shipment_document',{...args,p_size_bytes:png.length+1})).error?.code,'22023');
    assert.equal((await driver.rpc('register_shipment_document',args)).error,null,'Registration failed');assert.equal((await driver.rpc('register_shipment_document',args)).error,null);
    for(const role of ['admin','trader','driver']) {const signed=await sessions[role].client.storage.from('shipment-documents').createSignedUrl(objectPath,60);assert.equal(signed.error,null,`${role} authorized download`);const response=await fetch(signed.data.signedUrl);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);}
    for(const role of ['driver2','trader2']) {const rows=await sessions[role].client.from('documents').select('id').eq('id',documentId);assert.equal(rows.data.length,0);assert.ok((await sessions[role].client.storage.from('shipment-documents').createSignedUrl(objectPath,60)).error);}
    const publicResponse=await fetch(`${url}/storage/v1/object/public/shipment-documents/${objectPath}`);assert.notEqual(publicResponse.status,200);await publicResponse.arrayBuffer();
    await driver.storage.from('shipment-documents').remove([objectPath]);assert.equal((await driver.storage.from('shipment-documents').download(objectPath)).error,null,'Registered evidence must survive delete attempt');
    const orphanPath=`${shipmentId}/${sessions.driver.user.id}/${randomUUID()}.png`;objectPaths.push(orphanPath);
    assert.equal((await driver.storage.from('shipment-documents').upload(orphanPath,png,{contentType:'image/png'})).error,null);assert.equal((await driver.storage.from('shipment-documents').remove([orphanPath])).error,null);assert.ok((await driver.storage.from('shipment-documents').download(orphanPath)).error);
    console.log('PASS: real private Storage upload, metadata validation, signed downloads, denied foreign/public access and orphan cleanup.');

    if(process.env.TEST_APP_URL) {
      const origin=new URL(process.env.TEST_APP_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
      const cookies={};for(const role of ['driver','driver2','trader','trader2','admin']) {const jar=new Map();const ssr=createServerClient(url,key,{auth:{autoRefreshToken:false},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});assert.equal((await ssr.auth.setSession(sessions[role].session)).error,null);cookies[role]=[...jar].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');}
      const get=(path,role='driver')=>fetch(new URL(path,origin),{headers:{Cookie:cookies[role]},redirect:'manual'});
      const path=`/driver/shipments/${shipmentId}`;const html=await (await get(path)).text();assert.ok(html.includes('Upload evidence'));assert.ok(html.includes('phase-5-test.png'));
      assert.ok((await (await get(path,'driver2')).text()).includes('Assignment not found'));
      const post=body=>fetch(new URL(path,origin),{method:'POST',headers:{Cookie:cookies.driver,Origin:origin.origin},body,redirect:'manual'});
      const invalid=await post(payload(html,{status:'in_transit',note:'Test',latitude:91,longitude:96}));assert.equal(invalid.status,200);assert.ok((await invalid.text()).includes('Check the status, note and coordinates'));
      const submitted=payload(html,{status:'arrived_at_checkpoint',note:'Driver form checkpoint',latitude:21.9588,longitude:96.0891});assert.equal((await post(submitted)).status,303);
      const latest=await read();assert.equal(latest.status,'arrived_at_checkpoint');assert.equal(latest.current_lat,21.9588);
      assert.equal((await post(payload(html,{status:'arrived_at_checkpoint',note:'Driver form checkpoint',latitude:21.9588,longitude:96.0891}))).status,303,'Same form retry is idempotent');
      for(const role of ['admin','trader']) {const detail=await (await get(`/${role}/shipments/${shipmentId}`,role)).text();assert.ok(detail.includes('Driver form checkpoint'));assert.ok(detail.includes('21.95880'));assert.ok(detail.includes('phase-5-test.png'));}
      for(const role of ['admin','trader','driver']) {const download=await get(`/documents/${documentId}/download`,role);assert.equal(download.status,302);assert.ok(download.headers.get('cache-control').includes('no-store'));assert.equal((await fetch(download.headers.get('location'))).status,200);}
      assert.equal((await get(`/documents/${documentId}/download`,'trader2')).status,404);
      assert.equal((await get(`/documents/${documentId}/download`,'driver2')).status,404);
      console.log('PASS: actual Driver form validation/progress/retry, foreign-detail denial, refreshed Admin/Trader GPS/history and protected download routes.');
    }
    assert.equal((await driver.rpc('append_driver_update',await updateArgs({p_status:'delivered'}))).error,null);
    assert.equal((await driver.rpc('append_driver_update',await updateArgs({p_status:'delivered',p_note:'New after delivery'}))).error?.code,'PT422');
    console.log('PASS: delivered shipments reject new Driver updates.');
  } finally {
    if(objectPaths.length) {const removed=await cleanupClient.storage.from('shipment-documents').remove(objectPaths);assert.equal(removed.error,null,'Temporary Storage cleanup failed');}
    if(shipmentId) {const rows=await management('/database/query',{query:'delete from public.shipments where id=$1 and trader_id=$2 and cargo_type=$3 returning id',parameters:[shipmentId,traderId,marker]});assert.equal(rows.length,1);}
    for(const client of clients)await client.auth.signOut({scope:'local'});
    console.log('Removed temporary Phase 5 objects, shipment, evidence and history.');
  }
}
main().catch(printSafeError);
