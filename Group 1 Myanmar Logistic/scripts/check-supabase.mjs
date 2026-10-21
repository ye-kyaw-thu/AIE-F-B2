import { loadEnvironment, printSafeError } from './lib/environment.mjs';

async function main() {
  const { url, key } = loadEnvironment();
  const auth = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  if (!auth.ok) throw new Error(`Supabase Auth connection failed (${auth.status}). Check the project URL and publishable key.`);
  const settings = await auth.json();
  console.log(`Supabase Auth reachable. Email/password provider: ${settings.external?.email ? 'enabled' : 'check dashboard settings'}.`);
  const rest = await fetch(`${url}/rest/v1/shipments?select=id&limit=1`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  if ([401, 403].includes(rest.status)) console.log('Anonymous shipment access denied as expected.');
  else if (rest.status === 404) console.log('Shipment schema not available yet; run setup:supabase after adding the setup token.');
  else if (rest.ok) throw new Error('Anonymous shipment query unexpectedly succeeded. Review the schema permissions before using real data.');
  else throw new Error(`Shipment schema check returned ${rest.status}.`);
}
main().catch(printSafeError);
