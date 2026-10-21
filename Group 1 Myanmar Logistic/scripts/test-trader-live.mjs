import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { loadEnvironment, printSafeError } from './lib/environment.mjs';
import { DEMO_PASSWORD, museId, shipmentIds } from './lib/demo-data.mjs';

const marker = 'Phase 3 automated verification';
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => nativeFetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20000) });
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const input = { origin: 'Yangon', destination: 'Muse', cargo_type: marker, cargo_description: 'Temporary workflow verification record.',
  quantity: 2.5, quantity_unit: 'tonnes', pickup_date: tomorrow, route_gate_id: museId, special_notes: 'Created by automated Phase 3 tests.' };

function decode(value) {
  return value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}
function formPayload(html, values) {
  const form = html.match(/<form\b[^>]*class="shipment-form"[^>]*>([\s\S]*?)<\/form>/)?.[1];
  assert.ok(form, 'Expected the shipment form in the authenticated response.');
  const payload = new FormData();
  for (const tag of form.matchAll(/<input\b[^>]*>/g)) {
    if (!tag[0].includes('type="hidden"')) continue;
    const name = tag[0].match(/\bname="([^"]+)"/)?.[1];
    const value = tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? '';
    if (name) payload.append(decode(name), decode(value));
  }
  assert.ok([...payload.keys()].some(key => key.startsWith('$ACTION_')), 'Server Action metadata is missing.');
  for (const [key, value] of Object.entries(values)) payload.set(key, String(value));
  return payload;
}

async function main() {
  const { url, key, ref } = loadEnvironment();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  assert.ok(token, 'Setup token is needed to clean up only the temporary verification records.');
  const clients = [], cleanup = [];
  let traderId;
  const sessions = {};
  try {
    for (const email of ['trader@demo.com','trader2@demo.com','admin@demo.com','driver@demo.com']) {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      clients.push(client);
      const { data, error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
      assert.equal(error, null, `Login failed: ${email}`);
      sessions[email] = { client, session: data.session, user: data.user };
    }
    const trader = sessions['trader@demo.com'].client;
    const second = sessions['trader2@demo.com'].client;
    traderId = sessions['trader@demo.com'].user.id;
    const result = await trader.rpc('create_shipment', { p_input: input });
    assert.equal(result.error, null, 'Create RPC failed; apply the Phase 3 migration first.');
    const id = result.data;
    assert.match(id, /^[0-9a-f-]{36}$/);
    cleanup.push(id);
    const { data: row, error } = await trader.from('shipments').select('*').eq('id', id).single();
    assert.equal(error, null); assert.equal(row.trader_id, traderId); assert.equal(row.status, 'requested'); assert.equal(row.driver_id, null);
    const events = await trader.from('shipment_updates').select('id,actor_id').eq('shipment_id', id);
    assert.equal(events.error, null); assert.equal(events.data.length, 1); assert.equal(events.data[0].actor_id, traderId);
    const adminRead = await sessions['admin@demo.com'].client.from('shipments').select('id').eq('id', id);
    assert.equal(adminRead.error, null); assert.equal(adminRead.data.length, 1);
    const driverRead = await sessions['driver@demo.com'].client.from('shipments').select('id').eq('id', id);
    assert.equal(driverRead.error, null); assert.equal(driverRead.data.length, 0);
    const foreignRead = await second.from('shipments').select('id').eq('id', id);
    assert.equal(foreignRead.error, null); assert.equal(foreignRead.data.length, 0);
    const foreignEdit = await second.rpc('edit_requested_shipment', { p_shipment_id: id, p_expected_updated_at: row.updated_at, p_input: input });
    assert.equal(foreignEdit.error?.code, '42501');

    for (const email of ['admin@demo.com','driver@demo.com']) {
      const denied = await sessions[email].client.rpc('create_shipment', { p_input: input });
      assert.equal(denied.error?.code, '42501');
    }
    for (const patch of [{ trader_id: sessions['trader2@demo.com'].user.id }, { status: 'approved' }, { quantity: 0 }, { pickup_date: '2000-01-01' }]) {
      const invalid = await trader.rpc('create_shipment', { p_input: { ...input, ...patch } });
      assert.equal(invalid.error?.code, '22023');
    }
    const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await anon.rpc('create_shipment', { p_input: input })).error?.code, '42501');
    console.log('PASS: requested shipment + initial event, admin visibility, unassigned-driver/trader isolation and invalid/privileged create rejection.');

    // Two separate HTTP transactions race with the same revision; exactly one may win.
    const races = await Promise.all([3, 4].map(async quantity => {
      const response = await fetch(`${url}/rest/v1/rpc/edit_requested_shipment`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${sessions['trader@demo.com'].session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_shipment_id: id, p_expected_updated_at: row.updated_at, p_input: { ...input, quantity } }),
      });
      return { ok: response.ok, body: await response.json() };
    }));
    const raceSummary = races.map(result => ({ ok: result.ok, code: result.body?.code, message: result.body?.message }));
    assert.equal(races.filter(result => result.ok).length, 1, `Edit results: ${JSON.stringify(raceSummary)}`);
    assert.equal(races.filter(result => result.body?.code === 'PT409').length, 1, `Conflict results: ${JSON.stringify(raceSummary)}`);
    const after = await trader.from('shipments').select('*').eq('id', id).single();
    assert.ok([3,4].includes(after.data.quantity));
    assert.equal((await trader.from('shipment_updates').select('id').eq('shipment_id', id)).data.length, 2);
    const active = await trader.from('shipments').select('updated_at').eq('id', shipmentIds[0]).single();
    assert.equal((await trader.rpc('edit_requested_shipment', { p_shipment_id: shipmentIds[0], p_expected_updated_at: active.data.updated_at, p_input: input })).error?.code, 'PT422');
    console.log('PASS: concurrent edits prevent lost updates; active shipments reject trader edits.');

    if (process.env.TEST_APP_URL) {
      const origin = new URL(process.env.TEST_APP_URL);
      assert.ok(['localhost','127.0.0.1'].includes(origin.hostname), 'HTTP session tests target the local app only.');
      const cookieFor = async email => {
        const jar = new Map();
        const ssr = createServerClient(url, key, { auth: { autoRefreshToken: false }, cookies: {
          getAll: () => [...jar].map(([name,value]) => ({ name,value })),
          setAll: values => values.forEach(({name,value}) => jar.set(name,value)),
        } });
        assert.equal((await ssr.auth.setSession(sessions[email].session)).error, null);
        return [...jar].map(([name,value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
      };
      const cookie = await cookieFor('trader@demo.com');
      const get = path => fetch(new URL(path, origin), { headers: { Cookie: cookie }, redirect: 'manual' });
      for (const path of ['/trader/dashboard','/trader/shipments','/trader/shipments?status=requested',`/trader/shipments/${id}`,`/trader/shipments/${id}/edit`]) {
        const response = await get(path); assert.equal(response.status, 200, path);
        const html = await response.text();
        assert.ok(!html.includes('We couldn’t load') && !html.includes('NEXT_REDIRECT'), 'Unexpected route error: ' + path);
      }
      const ownDetail = await (await get(`/trader/shipments/${id}`)).text();
      assert.ok(ownDetail.includes(row.shipment_number));
      assert.ok(ownDetail.includes('Edit request'));
      const foreignDetail = await fetch(new URL(`/trader/shipments/${id}`, origin), { headers: { Cookie: await cookieFor('trader2@demo.com') } });
      const foreignBody = await foreignDetail.text();
      assert.ok(foreignBody.includes('Shipment not found'));
      assert.ok(!foreignBody.includes(row.shipment_number));
      const activeEdit = await (await get(`/trader/shipments/${shipmentIds[0]}/edit`)).text();
      assert.ok(!activeEdit.includes('class="shipment-form"'));

      const newHtml = await (await get('/trader/shipments/new')).text();
      const post = (path, payload) => fetch(new URL(path, origin), { method: 'POST', body: payload, redirect: 'manual',
        headers: { Cookie: cookie, Origin: origin.origin } });
      const invalidResponse = await post('/trader/shipments/new', formPayload(newHtml, { ...input, quantity: '0' }));
      assert.equal(invalidResponse.status, 200);
      assert.ok((await invalidResponse.text()).includes('Quantity must be greater than zero'));
      const submitted = await post('/trader/shipments/new', formPayload(newHtml, input));
      const location = submitted.headers.get('location');
      assert.equal(submitted.status, 303, 'Server Action should redirect after a successful save.');
      assert.ok(location?.includes('/trader/shipments/'));
      const formId = new URL(location, origin).pathname.split('/').at(-1);
      assert.match(formId, /^[0-9a-f-]{36}$/); cleanup.push(formId);
      const formRow = await trader.from('shipments').select('id,quantity,status').eq('id', formId).single();
      assert.equal(formRow.error, null); assert.equal(formRow.data.quantity, input.quantity);
      const editHtml = await (await get(`/trader/shipments/${formId}/edit`)).text();
      const edited = await post(`/trader/shipments/${formId}/edit`, formPayload(editHtml, { ...input, quantity: 9 }));
      assert.equal(edited.status, 303);
      assert.equal((await trader.from('shipments').select('quantity').eq('id', formId).single()).data.quantity, 9);
      console.log('PASS: authenticated list/filter/detail/edit routes, hidden foreign detail, closed edit UI, and actual create/edit Server Action form submissions including validation.');
    }
  } finally {
    if (cleanup.length && traderId) {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'delete from public.shipments where id = any($1::uuid[]) and trader_id=$2::uuid and cargo_type=$3 returning id', parameters: [cleanup, traderId, marker] }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) { console.error('Temporary test cleanup failed; only the automated verification records may remain.'); process.exitCode = 1; }
      else { const rows = await response.json(); assert.equal(rows.length, cleanup.length); console.log('Removed temporary workflow verification shipments and their dependent events.'); }
    }
    for (const client of clients) await client.auth.signOut({ scope: 'local' });
  }
}
main().catch(printSafeError);
