import { loadEnvironment, printSafeError } from './lib/environment.mjs';
import { applyMigrations } from './lib/migrations.mjs';

async function main() {
  const { ref } = loadEnvironment();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is needed for schema migrations.');
  await applyMigrations(async (query) => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Migration request failed (${response.status}). Review the SQL and project access.`);
    return response.json();
  });
  console.log('Schema is current. Existing users and shipments were preserved.');
}
main().catch(printSafeError);
