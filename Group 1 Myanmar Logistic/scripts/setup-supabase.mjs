import { applyMigrations } from './lib/migrations.mjs';
import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, printSafeError } from './lib/environment.mjs';
import { DEMO_MARKER, DEMO_PASSWORD, demoAccounts, demoShipments } from './lib/demo-data.mjs';


async function main() {
  const { url, ref } = loadEnvironment();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Add SUPABASE_ACCESS_TOKEN to .env.local to apply the migration and provision demo users. This is a server-only setup token, not the publishable key.');

  const api = async (suffix, body) => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${suffix}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Supabase setup request ${suffix.split('?')[0]} failed (${response.status}). Check token permissions and project availability.`);
    return response.json();
  };
  const query = (sql, parameters = []) => api('/database/query', { query: sql, parameters });

  // Retrieve an existing elevated key only in this setup process; never print or save it.
  const keys = await api('/api-keys?reveal=true');
  const elevated = keys.find(item => item.type === 'secret' && item.api_key?.startsWith('sb_secret_'))
    ?? keys.find(item => item.name === 'service_role' && item.api_key);
  if (!elevated) throw new Error('No usable setup key was returned. The token needs permission to read project secret API keys.');
  const admin = createClient(url, elevated.api_key, { auth: { persistSession: false, autoRefreshToken: false } });

  await applyMigrations(query);

  const existingUsers = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error('Could not inspect existing Auth users.');
    existingUsers.push(...data.users);
    if (data.users.length < 100) break;
  }
  for (const account of demoAccounts) {
    const user = existingUsers.find(user => user.email?.toLowerCase() === account.email);
    if (user && user.app_metadata?.demo_project !== DEMO_MARKER) {
      throw new Error(`Existing account ${account.email} was not created by this demo setup. It will not be modified.`);
    }
  }

  const userIds = {};
  for (const account of demoAccounts) {
    let user = existingUsers.find(user => user.email?.toLowerCase() === account.email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { full_name: account.name }, app_metadata: { demo_project: DEMO_MARKER },
      });
      if (error || !data.user) throw new Error(`Could not create ${account.email}. Check Auth settings and retry setup.`);
      user = data.user;
    }
    userIds[account.email] = user.id;
    const { data, error } = await admin.from('profiles').update({ role: account.role, full_name: account.name }).eq('id', user.id).select('id');
    if (error || data?.length !== 1) throw new Error(`Could not provision the profile for ${account.email}.`);
    console.log(`Ready: ${account.email} (${account.role}).`);
  }

  const shipments = demoShipments(userIds);
  const { error: seedError } = await admin.from('shipments').upsert(shipments, { onConflict: 'id', ignoreDuplicates: true });
  if (seedError) throw new Error(`Could not seed demo shipments (${seedError.code}). Retry setup after checking the migration.`);
  // Seed only missing timeline rows; never reset progress on a subsequent setup run.
  const steps = ['requested', 'approved', 'picked_up', 'in_transit', 'arrived_at_checkpoint', 'customs'];
  const events = [];
  for (const [index, shipment] of shipments.entries()) {
    for (const [stepIndex, status] of steps.slice(0, steps.indexOf(shipment.status) + 1).entries()) {
      const driverEvent = stepIndex >= 2;
      events.push({
        id: `30000000-0000-4000-8000-${String(index * 10 + stepIndex + 1).padStart(12, '0')}`,
        shipment_id: shipment.id, status, actor_id: driverEvent ? shipment.driver_id : status === 'requested' ? shipment.trader_id : userIds['admin@demo.com'],
        driver_id: driverEvent ? shipment.driver_id : null, note: 'Initial demo timeline event.', sync_status: 'synced',
        occurred_at: new Date(Date.now() - (10 - stepIndex) * 3600000).toISOString(),
        created_at: new Date(Date.now() - (10 - stepIndex) * 3600000).toISOString(),
      });
    }
  }
  const { error: eventError } = await admin.from('shipment_updates').upsert(events, { onConflict: 'id', ignoreDuplicates: true });
  if (eventError) throw new Error(`Could not seed timeline events (${eventError.code}).`);
  console.log('Demo data ready: 3 main shipments and 1 separate ownership-test shipment. No existing shipment progress was reset.');
  console.log('Next: npm run test:live, then sign in at /login with the documented demo password.');
}

main().catch(printSafeError);
