import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../scripts/lib/local-database.mjs';
import { museId } from '../scripts/lib/demo-data.mjs';

let db;
const trader = randomUUID(), secondTrader = randomUUID(), driver = randomUUID(), admin = randomUUID();
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const input = { origin: 'Yangon', destination: 'Muse', cargo_type: 'Textiles', cargo_description: 'Carefully packed textiles.',
  quantity: 12.5, quantity_unit: 'tonnes', pickup_date: tomorrow, route_gate_id: museId, special_notes: '' };

before(async () => {
  db = await createTestDatabase();
  for (const [id, role] of [[trader, 'trader'], [secondTrader, 'trader'], [driver, 'driver'], [admin, 'admin']]) {
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@test.invalid`]);
    await db.query('update public.profiles set role=$1 where id=$2', [role, id]);
  }
});
after(async () => { await db?.close(); });
function asUser(user, fn, role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? '']);
    return fn(tx);
  });
}
async function create(value = input, user = trader) {
  return (await asUser(user, tx => tx.query('select public.create_shipment($1::jsonb) as id', [JSON.stringify(value)]))).rows[0].id;
}
async function shipment(id) { return (await db.query('select * from public.shipments where id=$1', [id])).rows[0]; }
function version(row) { return row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at; }
function edit(id, timestamp, value = input, user = trader) {
  return asUser(user, tx => tx.query('select public.edit_requested_shipment($1,$2,$3::jsonb)', [id, timestamp, JSON.stringify(value)]));
}

test('create derives identity, starts requested/unassigned and appends one event atomically', async () => {
  const id = await create({ ...input, origin: '  Yangon  ' });
  const row = await shipment(id);
  assert.equal(row.trader_id, trader); assert.equal(row.driver_id, null);
  assert.equal(row.status, 'requested'); assert.equal(row.current_lat, null);
  assert.equal(row.origin, 'Yangon'); assert.match(row.shipment_number, /^MMT-\d{6}$/);
  const { rows } = await db.query('select * from public.shipment_updates where shipment_id=$1', [id]);
  assert.equal(rows.length, 1); assert.equal(rows[0].actor_id, trader); assert.equal(rows[0].status, 'requested');
});
test('admin, driver and anonymous cannot call trader mutations', async () => {
  for (const user of [admin, driver]) await assert.rejects(create(input, user), { code: '42501' });
  await assert.rejects(asUser(null, tx => tx.query('select public.create_shipment($1::jsonb)', [JSON.stringify(input)]), 'anon'), { code: '42501' });
});
test('injected owner, assignment, status and GPS fields are rejected', async () => {
  for (const field of ['trader_id','driver_id','status','current_lat','shipment_number','id']) {
    await assert.rejects(create({ ...input, [field]: 'forged' }), { code: '22023' });
  }
});
test('database validates dates, quantity, locations, units, types and gate independently of UI', async () => {
  const bad = [
    { quantity: 0 }, { quantity: -1 }, { quantity: 1.123 }, { quantity: 1e12 }, { quantity: '12' },
    { pickup_date: '2000-01-01' }, { pickup_date: '2027-02-31' }, { pickup_date: 'next Monday' },
    { origin: '  ' }, { destination: 'yangon ' }, { cargo_description: '' }, { cargo_type: 'x'.repeat(81) },
    { quantity_unit: 'containers' }, { route_gate_id: randomUUID() }, { route_gate_id: 'not-a-uuid' },
    { special_notes: null }, { origin: ['Yangon'] },
  ];
  for (const patch of bad) await assert.rejects(create({ ...input, ...patch }), { code: '22023' });
  await assert.rejects(create([]), { code: '22023' });
});
test('failed creation leaves no shipment or event behind', async () => {
  const count = async table => (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
  const shipments = await count('shipments'), events = await count('shipment_updates');
  await assert.rejects(create({ ...input, route_gate_id: randomUUID() }));
  assert.equal(await count('shipments'), shipments); assert.equal(await count('shipment_updates'), events);
});
test('owner can edit requested fields while identity, assignment and status remain unchanged', async () => {
  const id = await create(); const before = await shipment(id);
  await edit(id, version(before), { ...input, quantity: 20, special_notes: 'Call on arrival.' });
  const after = await shipment(id);
  assert.equal(Number(after.quantity), 20); assert.equal(after.special_notes, 'Call on arrival.');
  for (const key of ['id','trader_id','driver_id','shipment_number','status','current_lat','current_lng']) assert.equal(after[key], before[key]);
  assert.equal((await db.query('select count(*)::int as n from public.shipment_updates where shipment_id=$1', [id])).rows[0].n, 2);
});
test('another trader cannot read or edit a request even with a known ID/version', async () => {
  const id = await create(); const row = await shipment(id);
  await assert.rejects(edit(id, version(row), input, secondTrader), { code: '42501' });
  assert.equal((await asUser(secondTrader, tx => tx.query('select id from public.shipments where id=$1', [id]))).rows.length, 0);
  await assert.rejects(edit(randomUUID(), version(row)), { code: '42501' });
});
test('approval after a form was opened prevents edits and extra events', async () => {
  const id = await create(); const row = await shipment(id);
  await db.query("update public.shipments set driver_id=$1,status='approved' where id=$2", [driver, id]);
  await assert.rejects(edit(id, version(row)), { code: 'PT422' });
  assert.equal((await shipment(id)).status, 'approved');
  assert.equal((await db.query('select count(*)::int as n from public.shipment_updates where shipment_id=$1', [id])).rows[0].n, 1);
});
test('stale edits fail instead of overwriting a newer change', async () => {
  const id = await create(); const row = await shipment(id);
  await edit(id, version(row), { ...input, quantity: 14 });
  await assert.rejects(edit(id, version(row), { ...input, quantity: 16 }), { code: 'PT409' });
  assert.equal(Number((await shipment(id)).quantity), 14);
});
test('limited driver projection exposes a name only for authorized shipments', async () => {
  const id = await create();
  await db.query("update public.shipments set driver_id=$1 where id=$2", [driver, id]);
  await db.query("update public.profiles set full_name='Driver Name' where id=$1", [driver]);
  const result = await asUser(trader, tx => tx.query('select public.shipment_driver_name($1) as name', [id]));
  assert.equal(result.rows[0].name, 'Driver Name');
  await assert.rejects(asUser(secondTrader, tx => tx.query('select public.shipment_driver_name($1)', [id])), { code: '42501' });
});
test('existing closed gates allow requests for explicit admin review', async () => {
  await db.query("update public.gate_statuses set status='closed',reason='Demo closure' where id=$1", [museId]);
  assert.ok(await create());
});
