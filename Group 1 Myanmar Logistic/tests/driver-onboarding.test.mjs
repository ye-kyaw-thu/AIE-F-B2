import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from '../scripts/lib/local-database.mjs';
import {museId} from '../scripts/lib/demo-data.mjs';
let db;const admin=randomUUID(),trader=randomUUID();
before(async()=>{db=await createTestDatabase();for(const [id,role] of [[admin,'admin'],[trader,'trader']]){await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@test.invalid`]);await db.query('update public.profiles set role=$1 where id=$2',[role,id]);}});
after(async()=>{await db?.close();});
function asUser(uid,fn,role='authenticated'){return db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);return fn(tx);});}
async function reserve(email=`${randomUUID()}@test.invalid`,uid=admin){return (await asUser(uid,tx=>tx.query("select public.reserve_driver_invitation('Ko Aung',$1,'+95 9 123456789',null) as id",[email]))).rows[0].id;}
async function invited(){const email=`${randomUUID()}@test.invalid`,invitation=await reserve(email),id=randomUUID();await db.query('insert into auth.users(id,email,invited_at) values($1,$2,clock_timestamp())',[id,email]);await asUser(admin,tx=>tx.query('select public.finalize_driver_invitation($1,$2)',[invitation,id]));return {id,invitation,email};}
async function activate(id){return asUser(id,tx=>tx.query('select public.activate_invited_driver()'));}
async function access(id,expected,enable,uid=admin){return asUser(uid,tx=>tx.query('select public.set_driver_access($1,$2,$3)',[id,expected,enable]));}
async function profile(id){return (await db.query('select * from public.profiles where id=$1',[id])).rows[0];}
test('only authenticated Admins can reserve invitations or change Driver access',async()=>{
  for(const uid of [trader,null])await assert.rejects(reserve(undefined,uid),{code:'42501'});
  await assert.rejects(asUser(null,tx=>tx.query("select public.reserve_driver_invitation('Test','x@test.invalid','',null)"),'anon'),{code:'42501'});
  await assert.rejects(access(trader,'active',false,trader),{code:'42501'});
  await assert.rejects(access(trader,'active',false),{code:'PT404'});
});
test('reservations normalize email, refuse existing accounts and throttle retries',async()=>{
  const email=`${randomUUID()}@test.invalid`,id=await reserve(` ${email.toUpperCase()} `);
  assert.equal((await db.query('select email from public.driver_invitations where id=$1',[id])).rows[0].email,email);
  await assert.rejects(reserve(email),{code:'PT409'});
  await assert.rejects(reserve(`${trader}@test.invalid`),{code:'PT422'});
  await assert.rejects(asUser(admin,tx=>tx.query('select public.reserve_driver_invitation(null,null,null,$1)',[id])),{code:'PT429'});
  await db.query("update public.driver_invitations set last_attempt_at=clock_timestamp()-interval '2 minutes' where id=$1",[id]);
  assert.equal((await asUser(admin,tx=>tx.query('select public.reserve_driver_invitation(null,null,null,$1) as id',[id]))).rows[0].id,id);
});
test('metadata cannot create a Driver, and finalization requires trusted invitation evidence',async()=>{
  const email=`${randomUUID()}@test.invalid`,invitation=await reserve(email),id=randomUUID();
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"role\":\"driver\",\"driver_access\":\"active\"}')",[id,email]);
  assert.equal((await profile(id)).role,'trader');
  await assert.rejects(asUser(admin,tx=>tx.query('select public.finalize_driver_invitation($1,$2)',[invitation,id])),{code:'42501'});
  await assert.rejects(asUser(trader,tx=>tx.query('select public.finalize_driver_invitation($1,$2)',[invitation,id])),{code:'42501'});
  await db.query("update auth.users set invited_at=clock_timestamp(),created_at='2020-01-01' where id=$1",[id]);
  await assert.rejects(asUser(admin,tx=>tx.query('select public.finalize_driver_invitation($1,$2)',[invitation,id])),{code:'42501'});
});
test('invitation records are private and contact/access changes cannot bypass RPCs',async()=>{
  const {id}=await invited();
  assert.equal((await asUser(id,tx=>tx.query('select * from public.driver_invitations'))).rows.length,0);
  assert.ok((await asUser(admin,tx=>tx.query('select * from public.driver_invitations'))).rows.length>0);
  await assert.rejects(asUser(admin,tx=>tx.query("insert into public.driver_invitations(email,full_name,invited_by) values('direct@test.invalid','Test',$1)",[admin])),{code:'42501'});
  await assert.rejects(asUser(id,tx=>tx.query("update public.profiles set driver_access='active' where id=$1",[id])),{code:'42501'});
});
test('invited Drivers cannot work or receive assignments before email confirmation',async()=>{
  const {id}=await invited();assert.equal((await profile(id)).driver_access,'invited');
  assert.equal((await asUser(id,tx=>tx.query('select private.current_role() as role'))).rows[0].role,null);
  await assert.rejects(activate(id),{code:'42501'});
  await assert.rejects(db.query("insert into public.shipments(trader_id,driver_id,origin,destination,cargo_type,cargo_description,quantity,pickup_date,route_gate_id,status) values($1,$2,'Yangon','Muse','Rice','Bagged rice',2,current_date+1,$3,'approved')",[trader,id,museId]),{code:'22023'});
  await db.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[id]);await activate(id);await activate(id);
  assert.equal((await profile(id)).driver_access,'active');
  assert.equal((await db.query('select status from public.driver_invitations where driver_id=$1',[id])).rows[0].status,'accepted');
});
test('disabled Driver loses existing session data and mutation access while history is preserved',async()=>{
  const {id}=await invited();await db.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[id]);await activate(id);
  const shipment=randomUUID();await db.query("insert into public.shipments(id,trader_id,driver_id,origin,destination,cargo_type,cargo_description,quantity,pickup_date,route_gate_id,status) values($1,$2,$3,'Yangon','Muse','Rice','Bagged rice',2,current_date+1,$4,'approved')",[shipment,trader,id,museId]);
  assert.equal((await asUser(id,tx=>tx.query('select id from public.shipments where id=$1',[shipment]))).rows.length,1);
  await access(id,'active',false);
  assert.equal((await asUser(id,tx=>tx.query('select id from public.shipments where id=$1',[shipment]))).rows.length,0);
  const revision=(await db.query('select updated_at::text as revision from public.shipments where id=$1',[shipment])).rows[0].revision;
  await assert.rejects(asUser(id,tx=>tx.query("select public.append_driver_update($1,$2,$3,'picked_up','Collected',null,null,clock_timestamp())",[randomUUID(),shipment,revision])),{code:'42501'});
  await assert.rejects(activate(id),{code:'42501'});
  assert.equal((await db.query('select driver_id from public.shipments where id=$1',[shipment])).rows[0].driver_id,id);
  await assert.rejects(access(id,'active',true),{code:'PT409'});await access(id,'disabled',true);
  assert.equal((await asUser(id,tx=>tx.query('select id from public.shipments where id=$1',[shipment]))).rows.length,1);
});
test('restoring an incomplete invitation keeps Driver pending instead of granting active access',async()=>{
  const {id}=await invited();await access(id,'invited',false);await access(id,'disabled',true);
  assert.equal((await profile(id)).driver_access,'invited');
  await assert.rejects(activate(trader),{code:'42501'});
});
