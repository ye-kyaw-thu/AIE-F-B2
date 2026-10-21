import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from '../scripts/lib/local-database.mjs';
import {createRefreshScheduler} from '../src/lib/tracking/refresh-scheduler.mjs';
import {museId} from '../scripts/lib/demo-data.mjs';

let db;const trader=randomUUID(),driver=randomUUID(),other=randomUUID(),otherDriver=randomUUID(),admin=randomUUID(),shipment=randomUUID();
before(async()=>{
  db=await createTestDatabase();
  for(const [id,role] of [[trader,'trader'],[driver,'driver'],[other,'trader'],[otherDriver,'driver'],[admin,'admin']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@test.invalid`]);
    await db.query('update public.profiles set role=$1 where id=$2',[role,id]);
  }
  await db.query("insert into public.shipments(id,trader_id,driver_id,origin,destination,cargo_type,cargo_description,quantity,pickup_date,route_gate_id,status) values($1,$2,$3,'Yangon','Muse','Tracking test','Temporary cargo',1,current_date+1,$4,'in_transit')",[shipment,trader,driver,museId]);
  await db.query("insert into public.shipment_updates(shipment_id,actor_id,status,note,created_at) values($1,$2,'requested','Requested',now()-interval '2 days'),($1,$3,'in_transit','Stage skip',now()-interval '1 day')",[shipment,trader,admin]);
  await db.query("insert into public.shipment_updates(shipment_id,actor_id,driver_id,status,note) select $1,$2,$2,'in_transit','Repeated location' from generate_series(1,25)",[shipment,driver]);
});
after(async()=>{await db?.close();});
function milestones(user,role='authenticated') {return db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user??'']);return (await tx.query('select public.shipment_milestones($1) as milestones',[shipment])).rows[0].milestones;});}

test('publication exposes only intended insert/update tables, never delete/truncate events',async()=>{
  const publication=(await db.query("select pubinsert,pubupdate,pubdelete,pubtruncate,puballtables from pg_publication where pubname='supabase_realtime'")).rows[0];
  assert.deepEqual(publication,{pubinsert:true,pubupdate:true,pubdelete:false,pubtruncate:false,puballtables:false});
  const tables=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows.map(row=>row.tablename);
  assert.deepEqual(tables,['alerts','documents','gate_statuses','shipment_updates','shipments']);
});
test('timeline includes milestones beyond the recent 20 and does not invent skipped stages',async()=>{
  for(const user of [trader,driver,admin]) {
    const records=await milestones(user);assert.deepEqual(records.map(row=>row.status),['requested','in_transit']);
    assert.equal(records[1].event_count,26);assert.ok(new Date(records[1].first_at)<new Date(records[1].last_at));
  }
});
test('timeline denies foreign users, anonymous access and revoked driver assignment',async()=>{
  await assert.rejects(milestones(other),{code:'42501'});await assert.rejects(milestones(null,'anon'),{code:'42501'});
  await db.query('update public.shipments set driver_id=$1 where id=$2',[otherDriver,shipment]);
  try {await assert.rejects(milestones(driver),{code:'42501'});} finally {await db.query('update public.shipments set driver_id=$1 where id=$2',[driver,shipment]);}
});
test('status correction preserves previously recorded later milestones',async()=>{
  await db.query("update public.shipments set status='approved' where id=$1",[shipment]);
  assert.ok((await milestones(trader)).some(row=>row.status==='in_transit'));
});
function schedulerHarness() {
  let allowed=true,refreshes=0,next=0;const tasks=new Map();
  const scheduler=createRefreshScheduler({canRefresh:()=>allowed,refresh:()=>refreshes++,schedule:fn=>{const id=++next;tasks.set(id,fn);return id;},cancel:id=>tasks.delete(id)});
  return {scheduler,tasks,get refreshes(){return refreshes;},block(){allowed=false;},allow(){allowed=true;},tick(){const pending=[...tasks.values()];tasks.clear();pending.forEach(fn=>fn());}};
}
test('bursts coalesce into one refresh; later updates still refresh',()=>{
  const h=schedulerHarness();for(let i=0;i<100;i++)h.scheduler.request();assert.equal(h.tasks.size,1);h.tick();assert.equal(h.refreshes,1);h.scheduler.request();h.tick();assert.equal(h.refreshes,2);
});
test('offline, hidden, editing or in-flight blocks retain pending work until resume',()=>{
  const h=schedulerHarness();h.scheduler.request();h.block();h.tick();assert.equal(h.refreshes,0);h.allow();h.scheduler.flush();h.tick();assert.equal(h.refreshes,1);
});
test('unmount or logout cancels scheduled refreshes and ignores subsequent events',()=>{
  const h=schedulerHarness();h.scheduler.request();const late=[...h.tasks.values()][0];h.scheduler.dispose();h.scheduler.request();h.scheduler.flush();late();assert.equal(h.tasks.size,0);assert.equal(h.refreshes,0);
});
