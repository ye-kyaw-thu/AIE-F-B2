import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../scripts/lib/local-database.mjs';
import { museId } from '../scripts/lib/demo-data.mjs';

let db;
const admin=randomUUID(), trader=randomUUID(), driver=randomUUID(), secondDriver=randomUUID();
before(async()=>{
  db=await createTestDatabase();
  for(const [id,role] of [[admin,'admin'],[trader,'trader'],[driver,'driver'],[secondDriver,'driver']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@test.invalid`]);
    await db.query('update public.profiles set role=$1 where id=$2',[role,id]);
  }
});
after(async()=>{await db?.close();});
function asUser(user,fn,role='authenticated') { return db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user ?? '']);return fn(tx);}); }
async function fresh() { const id=randomUUID();await db.query("insert into public.shipments(id,trader_id,origin,destination,cargo_type,cargo_description,quantity,pickup_date,route_gate_id) values($1,$2,'Yangon','Muse','Textiles','Packed textiles',12,current_date+1,$3)",[id,trader,museId]);return id; }
async function row(id) {return (await db.query('select *,updated_at::text as revision from public.shipments where id=$1',[id])).rows[0];}
async function manage(id,action,options={}) {return asUser(options.user ?? admin,tx=>tx.query('select public.manage_shipment($1,$2,$3,$4,$5,$6)',[id,options.revision,action,options.driver ?? null,options.status ?? 'approved',options.note ?? '']),options.role ?? 'authenticated');}
async function change(id,action,options={}) {return manage(id,action,{revision:(await row(id)).revision,...options});}
async function events(id) {return (await db.query('select * from public.shipment_updates where shipment_id=$1',[id])).rows;}
async function gateVersion() {return (await db.query('select updated_at::text as revision from public.gate_statuses where id=$1',[museId])).rows[0].revision;}
async function gate(status,reason,options={}) {return asUser(options.user ?? admin,tx=>tx.query('select public.change_gate_status($1,$2,$3,$4)',[museId,options.revision,status,reason]),options.role ?? 'authenticated');}

test('only admins may assign, approve, correct status or change gates',async()=>{
  const id=await fresh();
  for(const user of [trader,driver]) for(const action of ['assign','approve','status']) await assert.rejects(change(id,action,{user,driver}),{code:'42501'});
  await assert.rejects(change(id,'assign',{user:'',role:'anon',driver}),{code:'42501'});
  for(const user of [trader,driver]) await assert.rejects(gate('closed','Test',{user,revision:await gateVersion()}),{code:'42501'});
  await assert.rejects(gate('closed','Test',{user:'',role:'anon',revision:await gateVersion()}),{code:'42501'});
});
test('assignment validates driver role, exposes shipment only to assigned driver, and appends admin history',async()=>{
  const id=await fresh();
  for(const candidate of [trader,admin,randomUUID()]) await assert.rejects(change(id,'assign',{driver:candidate}),{code:'22023'});
  await change(id,'assign',{driver}); assert.equal((await row(id)).driver_id,driver);
  assert.equal((await events(id))[0].actor_id,admin);
  assert.equal((await asUser(driver,tx=>tx.query('select id from public.shipments where id=$1',[id]))).rows.length,1);
  assert.equal((await asUser(secondDriver,tx=>tx.query('select id from public.shipments where id=$1',[id]))).rows.length,0);
  await change(id,'assign',{driver:secondDriver});
  assert.equal((await asUser(driver,tx=>tx.query('select id from public.shipments where id=$1',[id]))).rows.length,0);
});
test('approval requires assigned request and permanently closes trader request edits',async()=>{
  const id=await fresh();
  await assert.rejects(change(id,'approve'),{code:'PT422'});
  await change(id,'assign',{driver});await change(id,'approve');
  assert.equal((await row(id)).status,'approved');assert.equal((await events(id)).length,2);
  await assert.rejects(change(id,'approve'),{code:'PT422'});
  await assert.rejects(asUser(trader,tx=>tx.query('select public.edit_requested_shipment($1,$2,$3)',[id,(new Date()).toISOString(),{}])),{code:'PT422'});
});
test('status correction requires approval, a changed status and a reason; retains identity and GPS',async()=>{
  const id=await fresh(); await assert.rejects(change(id,'status',{status:'delivered',note:'Fix'}),{code:'PT422'});
  await change(id,'assign',{driver});await change(id,'approve');
  await assert.rejects(change(id,'status',{status:'in_transit'}),{code:'22023'});
  await assert.rejects(change(id,'status',{status:'approved',note:'Fix'}),{code:'PT422'});
  const initial=await row(id);await change(id,'status',{status:'in_transit',note:'Operations confirmed departure.'});
  const updated=await row(id);assert.equal(updated.status,'in_transit');
  for(const key of ['trader_id','driver_id','current_lat','current_lng','shipment_number']) assert.equal(updated[key],initial[key]);
  assert.match((await events(id)).at(-1).note,/Operations confirmed departure/);
});
test('assignment stays locked after progress even if admin corrects status back to approved',async()=>{
  const id=await fresh();await change(id,'assign',{driver});await change(id,'approve');
  await change(id,'status',{status:'picked_up',note:'Confirmed'});await change(id,'status',{status:'approved',note:'Correct record'});
  await assert.rejects(change(id,'assign',{driver:secondDriver}),{code:'PT422'});
  await assert.rejects(change(id,'status',{status:'requested',note:'Reopen'}),{code:'PT422'});
});
test('stale admin revision cannot overwrite assignment and failed changes leave no event',async()=>{
  const id=await fresh(), revision=(await row(id)).revision;
  await change(id,'assign',{driver});
  await assert.rejects(manage(id,'assign',{revision,driver:secondDriver}),{code:'PT409'});
  await assert.rejects(manage(id,'approve',{revision:null}),{code:'PT409'});
  assert.equal((await row(id)).driver_id,driver);assert.equal((await events(id)).length,1);
});
test('gate changes require disruption reason, stamp actor, expose condition and reject stale changes',async()=>{
  const revision=await gateVersion();
  await assert.rejects(gate('closed',' ',{revision}),{code:'22023'});
  await assert.rejects(gate('delayed','x'.repeat(1001),{revision}),{code:'22023'});
  await gate('closed','Demo border closure',{revision});
  const result=(await asUser(trader,tx=>tx.query('select * from public.gate_statuses where id=$1',[museId]))).rows[0];
  assert.equal(result.status,'closed');assert.equal(result.updated_by,admin);assert.equal(result.reason,'Demo border closure');
  await assert.rejects(gate('open','',{revision}),{code:'PT409'});
  await gate('open','Reopened',{revision:await gateVersion()});
});
