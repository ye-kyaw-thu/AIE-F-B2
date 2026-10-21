import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { loadEnvironment, printSafeError } from './lib/environment.mjs';
import { demoAccounts, DEMO_PASSWORD, shipmentIds } from './lib/demo-data.mjs';

async function main() {
  const { url, key } = loadEnvironment();
  const clients = [];
  const sessions = {};
  try {
    for (const account of demoAccounts) {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      clients.push(client);
      const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: DEMO_PASSWORD });
      assert.equal(error, null, `Login failed for ${account.email}; complete setup first.`);
      assert.ok(data.user);
      const { data: profile, error: profileError } = await client.from('profiles').select('id,role').eq('id', data.user.id).single();
      assert.equal(profileError, null, 'Profile lookup failed.');
      assert.equal(profile.role, account.role, 'Unexpected provisioned role.');
      sessions[account.email] = { client, user: data.user, session: data.session };
    }
    console.log('PASS: all five demo/test accounts authenticate and have expected database roles.');

    const expected = {
      'admin@demo.com': shipmentIds,
      'trader@demo.com': shipmentIds.slice(0, 3),
      'driver@demo.com': [shipmentIds[0], shipmentIds[2]],
      'trader2@demo.com': [shipmentIds[3]],
      'driver2@demo.com': [shipmentIds[3]],
    };
    for (const account of demoAccounts) {
      const { client, user } = sessions[account.email];
      const { data, error } = await client.from('shipments').select('id').in('id', shipmentIds);
      assert.equal(error, null);
      assert.deepEqual(data.map(row => row.id).sort(), [...expected[account.email]].sort(), `RLS violation for ${account.email}`);
      if (account.role !== 'admin') {
        const foreign = account.email.includes('2@') ? shipmentIds[0] : shipmentIds[3];
        const lookup = await client.from('shipments').select('id').eq('id', foreign);
        assert.equal(lookup.error, null); assert.equal(lookup.data.length, 0);
        const profiles = await client.from('profiles').select('id');
        assert.equal(profiles.error, null); assert.deepEqual(profiles.data.map(row => row.id), [user.id]);
      }
      // No-op writes verify column privileges without changing valid data if a policy regresses.
      const escalation = await client.from('profiles').update({ role: account.role }).eq('id', user.id);
      assert.equal(escalation.error?.code, '42501', 'Direct role writes must be denied, even to the same role.');
      const forbidden = await client.from('shipments').update({ special_notes: 'permission-test' }).eq('id', '00000000-0000-0000-0000-000000000000');
      assert.equal(forbidden.error?.code, '42501', 'Operational write grant must not exist in Phase 2.');
    }
    console.log('PASS: direct API role/ownership isolation, direct-ID lookups and privileged-column/write rejection.');

    const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const table of ['profiles','shipments','shipment_updates','gate_statuses','alerts','documents']) {
      const { error } = await anon.from(table).select('*').limit(1);
      assert.equal(error?.code, '42501', `Anonymous access unexpectedly allowed: ${table}`);
    }
    const invalid = await anon.auth.signInWithPassword({ email: 'trader@demo.com', password: 'DefinitelyIncorrect-Password' });
    assert.ok(invalid.error); assert.equal(invalid.data.session, null);
    console.log('PASS: anonymous reads and invalid credentials are rejected.');

    // Optional HTTP verification, enabled only when explicitly requested with an app URL.
    const app = process.env.TEST_APP_URL;
    if (app) {
      const origin = new URL(app);
      assert.ok(['localhost','127.0.0.1'].includes(origin.hostname), 'HTTP test cookie transport is limited to the local app.');
      for (const role of ['admin','trader','driver']) {
        const response = await fetch(new URL(`/${role}/dashboard`, origin), { redirect: 'manual' });
        const location = response.headers.get('location');
        const body = await response.text();
        assert.ok(location?.endsWith('/login') || body.includes('NEXT_REDIRECT;replace;/login;'), 'Anonymous dashboard must redirect to login.');
        assert.ok(!body.includes('shipment-number'), 'Anonymous response must not include shipment records.');
      }
      for (const role of ['admin','trader','driver']) {
        const jar = new Map();
        const ssr = createServerClient(url, key, {
          auth: { autoRefreshToken: false },
          cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
            setAll: values => values.forEach(({ name, value }) => jar.set(name, value)) },
        });
        const { error } = await ssr.auth.setSession(sessions[`${role}@demo.com`].session);
        assert.equal(error, null);
        const cookie = [...jar].map(([name,value]) => `${name}=${encodeURIComponent(value)}`).join('; ') + '; logistics-language=en';
        const allowed = await fetch(new URL(`/${role}/dashboard`, origin), { headers: { Cookie: cookie }, redirect: 'manual' });
        assert.equal(allowed.status, 200);
        assert.match(allowed.headers.get('cache-control') ?? '', /private|no-store/);
        const html = await allowed.text();
        assert.ok(html.includes('Sign out'));
        const localized = await fetch(new URL(`/${role}/dashboard`, origin), {headers:{Cookie:cookie.replace('logistics-language=en','logistics-language=my')}});
        assert.equal(localized.status,200);
        const localizedHtml = await localized.text();
        assert.ok(localizedHtml.includes('<html lang="my"'), 'Authenticated document must use Burmese.');
        assert.ok(localizedHtml.includes('အကောင့်မှ ထွက်ရန်'), 'Authenticated interface must translate sign out.');
        assert.ok(localizedHtml.includes('class="language-switch"'), 'Authenticated workspace must expose language controls.');
        assert.ok(!html.includes('We couldn’t load shipments'));
        const other = role === 'admin' ? 'trader' : 'admin';
        const denied = await fetch(new URL(`/${other}/dashboard`, origin), { headers: { Cookie: cookie }, redirect: 'manual' });
        const location = denied.headers.get('location');
        // Next.js can emit a streaming redirect after a parent boundary has started.
        assert.ok(location?.endsWith(`/${role}/dashboard`) || (await denied.text()).includes(`NEXT_REDIRECT;replace;/${role}/dashboard`));
      }
      console.log('PASS: anonymous route redirects, authenticated dashboards and cross-role route rejection.');
      console.log('PASS: Admin, Trader and Driver dashboards render Burmese with language controls.');
    }
  } finally {
    for (const client of clients) await client.auth.signOut({ scope: 'local' });
  }
}
main().catch(printSafeError);
