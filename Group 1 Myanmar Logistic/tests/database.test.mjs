import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../scripts/lib/local-database.mjs';
import { demoAccounts, demoShipments, shipmentIds, museId } from '../scripts/lib/demo-data.mjs';

let db;
const ids = Object.fromEntries(demoAccounts.map((user, index) => [user.email, `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
const admin = ids['admin@demo.com'], trader = ids['trader@demo.com'], driver = ids['driver@demo.com'];
const otherTrader = ids['trader2@demo.com'], otherDriver = ids['driver2@demo.com'];
const alertId = '50000000-0000-4000-8000-000000000001';
const documentId = '60000000-0000-4000-8000-000000000001';
const objectPath = `${shipmentIds[0]}/${driver}/${documentId}.pdf`;

async function asUser(user, callback, role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    return callback(tx);
  });
}
async function insert(table, row) {
  const keys = Object.keys(row);
  return db.query(`insert into public.${table} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
}
before(async () => {
  db = await createTestDatabase();
  for (const user of demoAccounts) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [ids[user.email], user.email, JSON.stringify({ full_name: user.name, role: 'admin' })]);
    await db.query('update public.profiles set role = $1 where id = $2', [user.role, ids[user.email]]);
  }
  for (const shipment of demoShipments(ids)) {
    await insert('shipments', shipment);
    await insert('shipment_updates', { shipment_id: shipment.id, actor_id: shipment.trader_id, status: 'requested' });
  }
  await insert('alerts', { id: alertId, trader_id: trader, shipment_id: shipmentIds[0], gate_id: museId, title: 'Demo alert', message: 'Test notification' });
  await insert('documents', { id: documentId, shipment_id: shipmentIds[0], driver_id: driver, document_type: 'customs', file_url: objectPath, original_name: 'test.pdf', mime_type: 'application/pdf', size_bytes: 100 });
  await db.query("insert into storage.objects(bucket_id,name) values ('shipment-documents',$1)", [objectPath]);
});
after(async () => { await db?.close(); });

test('all seven operational tables enable RLS', async () => {
  const { rows } = await db.query("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
  assert.equal(rows.length, 7); assert.ok(rows.every(row => row.relrowsecurity));
});
test('signup metadata cannot assign an elevated role; email changes mirror', async () => {
  const id = '40000000-0000-4000-8000-000000000009';
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [id, 'new@test.invalid', '{"role":"admin","full_name":"New User"}']);
  assert.equal((await db.query('select role from public.profiles where id=$1', [id])).rows[0].role, 'trader');
  await db.query('update auth.users set email=$1 where id=$2', ['changed@test.invalid', id]);
  assert.equal((await db.query('select email from public.profiles where id=$1', [id])).rows[0].email, 'changed@test.invalid');
});
test('anonymous users cannot read any operational table', async () => {
  for (const table of ['profiles','shipments','shipment_updates','gate_statuses','alerts','documents']) {
    await assert.rejects(asUser(null, tx => tx.query(`select * from public.${table}`), 'anon'), { code: '42501' });
  }
});
test('admin sees all shipments', async () => {
  assert.equal((await asUser(admin, tx => tx.query('select * from public.shipments'))).rows.length, 4);
});
test('traders only see their own shipments, including direct ID lookups', async () => {
  assert.equal((await asUser(trader, tx => tx.query('select * from public.shipments'))).rows.length, 3);
  assert.equal((await asUser(otherTrader, tx => tx.query('select * from public.shipments'))).rows.length, 1);
  assert.equal((await asUser(trader, tx => tx.query('select * from public.shipments where id=$1', [shipmentIds[3]]))).rows.length, 0);
});
test('drivers only see assigned shipments; unassigned is invisible', async () => {
  assert.equal((await asUser(driver, tx => tx.query('select * from public.shipments'))).rows.length, 2);
  assert.equal((await asUser(otherDriver, tx => tx.query('select * from public.shipments'))).rows.length, 1);
  assert.equal((await asUser(driver, tx => tx.query('select * from public.shipments where id=$1', [shipmentIds[1]]))).rows.length, 0);
});
test('profile policies avoid recursion and hide unrelated email addresses', async () => {
  assert.equal((await asUser(driver, tx => tx.query('select * from public.profiles'))).rows.length, 1);
  assert.equal((await asUser(trader, tx => tx.query('select * from public.profiles where id=$1', [otherTrader]))).rows.length, 0);
  assert.ok((await asUser(admin, tx => tx.query('select * from public.profiles'))).rows.length >= 5);
});
test('user cannot promote role, replace identity, or modify email', async () => {
  for (const [column, value] of [['role','admin'],['email','hijacked@test.invalid'],['id',admin]]) {
    await assert.rejects(asUser(trader, tx => tx.query(`update public.profiles set ${column}=$1 where id=$2`, [value, trader])), { code: '42501' });
  }
});
test('user can rename self but not someone else', async () => {
  assert.equal((await asUser(trader, tx => tx.query("update public.profiles set full_name='Updated Name' where id=$1 returning id", [trader]))).rows.length, 1);
  assert.equal((await asUser(trader, tx => tx.query("update public.profiles set full_name='Hijacked Name' where id=$1 returning id", [otherTrader]))).rows.length, 0);
});
test('direct operational writes are denied until validated workflow functions exist', async () => {
  for (const user of [admin,trader,driver]) {
    for (const sql of ["update public.shipments set status='delivered'", 'delete from public.shipments', "insert into public.gate_statuses(gate_name,location) values ('Fake','Fake')", "insert into public.shipment_updates(shipment_id,actor_id,status) values ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','delivered')"]) {
      await assert.rejects(asUser(user, tx => tx.exec(sql)), { code: '42501' });
    }
  }
});
test('history and document reads follow shipment ownership', async () => {
  assert.equal((await asUser(trader, tx => tx.query('select * from public.shipment_updates'))).rows.length, 3);
  assert.equal((await asUser(driver, tx => tx.query('select * from public.shipment_updates'))).rows.length, 2);
  assert.equal((await asUser(otherTrader, tx => tx.query('select * from public.documents'))).rows.length, 0);
  assert.equal((await asUser(driver, tx => tx.query('select * from public.documents'))).rows.length, 1);
});
test('only alert recipient can change its read flag, never content', async () => {
  assert.equal((await asUser(otherTrader, tx => tx.query('select * from public.alerts'))).rows.length, 0);
  assert.equal((await asUser(driver, tx => tx.query('select * from public.alerts'))).rows.length, 0);
  assert.equal((await asUser(trader, tx => tx.query('update public.alerts set is_read=true where id=$1 returning id', [alertId]))).rows.length, 1);
  assert.equal((await asUser(otherTrader, tx => tx.query('update public.alerts set is_read=false where id=$1 returning id', [alertId]))).rows.length, 0);
  await assert.rejects(asUser(trader, tx => tx.query("update public.alerts set message='Forged' where id=$1", [alertId])), { code: '42501' });
});
test('private evidence objects are visible only to authorized shipment viewers', async () => {
  assert.equal((await db.query("select public from storage.buckets where id='shipment-documents'")).rows[0].public, false);
  for (const user of [admin,trader,driver]) assert.equal((await asUser(user, tx => tx.query('select * from storage.objects'))).rows.length, 1);
  for (const user of [otherTrader,otherDriver]) assert.equal((await asUser(user, tx => tx.query('select * from storage.objects'))).rows.length, 0);
  assert.equal((await asUser(null, tx => tx.query('select * from storage.objects'), 'anon')).rows.length, 0);
});
test('participant roles and coordinate/quantity checks are enforced by PostgreSQL', async () => {
  // Reassigning to a non-driver is intercepted by the active-driver guard trigger.
  await assert.rejects(db.exec(`update public.shipments set driver_id='${trader}' where id='${shipmentIds[0]}'`), { code: '22023' });
  for (const sql of [
    `update public.shipments set trader_id='${driver}' where id='${shipmentIds[0]}'`,
    `update public.shipments set current_lat=91 where id='${shipmentIds[0]}'`,
    `update public.shipments set current_lat=null where id='${shipmentIds[0]}'`,
    `update public.shipments set quantity=0 where id='${shipmentIds[0]}'`,
    `update public.shipments set quantity='NaN' where id='${shipmentIds[0]}'`,
    `update public.gate_statuses set status='closed', reason='' where id='${museId}'`,
  ]) await assert.rejects(db.exec(sql), { code: '23514' });
});
test('alert recipient/route cannot reference a different shipment owner', async () => {
  await assert.rejects(insert('alerts', { trader_id: otherTrader, shipment_id: shipmentIds[0], title: 'Wrong recipient', message: 'Invalid' }), { code: '23514' });
});
test('pending records cannot be committed; UUID retries cannot duplicate events', async () => {
  await assert.rejects(insert('shipment_updates', { shipment_id: shipmentIds[0], actor_id: trader, status: 'requested', sync_status: 'pending' }), { code: '23514' });
  const id = '70000000-0000-4000-8000-000000000001';
  const row = { id, shipment_id: shipmentIds[0], actor_id: trader, status: 'requested' };
  await insert('shipment_updates', row);
  await assert.rejects(insert('shipment_updates', row), { code: '23505' });
});
test('anonymous users cannot execute private authorization helpers', async () => {
  await assert.rejects(asUser(null, tx => tx.query('select private.current_role()'), 'anon'), { code: '42501' });
});
