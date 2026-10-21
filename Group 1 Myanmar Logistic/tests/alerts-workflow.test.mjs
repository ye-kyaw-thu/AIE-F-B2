import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from '../scripts/lib/local-database.mjs';

let db;const admin=randomUUID(),trader=randomUUID(),trader2=randomUUID(),driver=randomUUID(),gateId=randomUUID();
before(async()=>{
  db=await createTestDatabase();
  for(const [id,role] of [[admin,'admin'],[trader,'trader'],[trader2,'trader'],[driver,'driver']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@test.invalid`]);
    await db.query('update public.profiles set role=$1 where id=$2',[role,id]);
  }
  await db.query("insert into public.gate_statuses(id,gate_name,location) values($1,'Phase 7 Gate','Test border')",[gateId]);
});
after(async()=>{await db?.close();});
test('alert RPCs reject missing identities and missing profiles without writing',async()=>{
  const beforeCount=(await db.query('select count(*)::int as count from public.alerts')).rows[0].count;
  const missingProfile=randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)',[missingProfile,`${missingProfile}@test.invalid`]);
  await db.query('delete from public.profiles where id=$1',[missingProfile]);
  for(const user of [null,missingProfile]) {
    await assert.rejects(asUser(user,tx=>tx.query("select public.broadcast_alert('Unauthorized','Must never be sent')")),{code:'42501'});
    await assert.rejects(asUser(user,tx=>tx.query('select public.mark_alert_read($1,true)',[randomUUID()])),{code:'42501'});
  }
  assert.equal((await db.query('select count(*)::int as count from public.alerts')).rows[0].count,beforeCount);
});
function asUser(user,fn,role='authenticated'){return db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user??'']);return fn(tx);});}
async function shipment(owner,status='approved'){const id=randomUUID();await db.query("insert into public.shipments(id,trader_id,driver_id,origin,destination,cargo_type,cargo_description,quantity,pickup_date,route_gate_id,status) values($1,$2,$3,'Yangon','Muse','Alert test','Cargo',1,current_date+1,$4,$5)",[id,owner,driver,gateId,status]);return id;}
async function gate(status,reason){const revision=(await db.query('select updated_at::text as revision from public.gate_statuses where id=$1',[gateId])).rows[0].revision;return asUser(admin,tx=>tx.query('select public.change_gate_status($1,$2,$3,$4)',[gateId,revision,status,reason]));}
async function rows(){return (await db.query('select * from public.alerts order by created_at,id')).rows;}

test('a real delayed/closed transition alerts each active shipment owner once',async()=>{
  const a=await shipment(trader),b=await shipment(trader),c=await shipment(trader2),delivered=await shipment(trader2,'delivered');
  await gate('delayed','Queue at inspection');let alerts=await rows();assert.equal(alerts.length,3);
  assert.deepEqual(new Set(alerts.map(row=>row.shipment_id)),new Set([a,b,c]));assert.ok(alerts.every(row=>row.gate_id===gateId&&row.title==='Phase 7 Gate Gate Delayed'&&row.message.includes('Queue at inspection')));
  assert.equal(alerts.some(row=>row.shipment_id===delivered),false);
  await gate('delayed','Updated delay note');assert.equal((await rows()).length,3,'note-only update must not duplicate alerts');
  await gate('closed','Temporary closure');alerts=await rows();assert.equal(alerts.length,6);assert.equal(alerts.filter(row=>row.title.endsWith('Closed')).length,3);
  await gate('open','Route reopened');assert.equal((await rows()).length,6,'open transition does not create disruption alert');
});
test('Admin broadcast creates one private row per trader and validates content',async()=>{
  const beforeCount=(await rows()).length;
  const sent=await asUser(admin,tx=>tx.query("select public.broadcast_alert('Operations notice','Customs desk closes at 17:00') as count"));assert.equal(sent.rows[0].count,2);
  const broadcasts=(await rows()).slice(beforeCount);assert.equal(broadcasts.length,2);assert.deepEqual(new Set(broadcasts.map(row=>row.trader_id)),new Set([trader,trader2]));assert.ok(broadcasts.every(row=>row.shipment_id===null&&row.gate_id===null));
  for(const user of [trader,driver])await assert.rejects(asUser(user,tx=>tx.query("select public.broadcast_alert('No','Access')")),{code:'42501'});
  await assert.rejects(asUser(null,tx=>tx.query("select public.broadcast_alert('No','Access')"),'anon'),{code:'42501'});
  await assert.rejects(asUser(admin,tx=>tx.query("select public.broadcast_alert(' ','Message')")),{code:'22023'});
});
test('Trader sees and marks only own alerts; Admin and Driver cannot mark them',async()=>{
  const own=(await asUser(trader,tx=>tx.query('select * from public.alerts order by created_at limit 1'))).rows[0];assert.ok(own);assert.equal(own.is_read,false);
  assert.ok((await asUser(trader2,tx=>tx.query('select id from public.alerts where trader_id=$1',[trader]))).rows.length===0);
  await asUser(trader,tx=>tx.query('select public.mark_alert_read($1,true)',[own.id]));assert.equal((await db.query('select is_read from public.alerts where id=$1',[own.id])).rows[0].is_read,true);
  await asUser(trader,tx=>tx.query('select public.mark_alert_read($1,false)',[own.id]));assert.equal((await db.query('select is_read from public.alerts where id=$1',[own.id])).rows[0].is_read,false);
  const foreign=(await db.query('select id from public.alerts where trader_id=$1 limit 1',[trader2])).rows[0].id;
  await assert.rejects(asUser(trader,tx=>tx.query('select public.mark_alert_read($1,true)',[foreign])),{code:'PT404'});
  for(const user of [admin,driver])await assert.rejects(asUser(user,tx=>tx.query('select public.mark_alert_read($1,true)',[own.id])),{code:'42501'});
});
