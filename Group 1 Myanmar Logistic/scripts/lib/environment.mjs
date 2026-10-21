import { existsSync } from 'node:fs';

export function loadEnvironment() {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Set the Supabase URL and publishable key in .env.local.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(parsed.hostname)) {
    throw new Error('Setup requires a hosted Supabase project URL.');
  }
  return { url: parsed.origin, key, ref: parsed.hostname.split('.')[0] };
}

export function printSafeError(error) {
  let message = error instanceof Error ? error.message : 'Operation failed.';
  for (const [name, value] of Object.entries(process.env)) {
    if (value && /KEY|TOKEN|PASSWORD/.test(name)) message = message.split(value).join('[redacted]');
  }
  console.error(message);
  process.exitCode = 1;
}
