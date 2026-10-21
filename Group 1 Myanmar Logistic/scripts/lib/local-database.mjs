import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

export const migrationPath = 'supabase/migrations/20260913000100_foundation.sql';

export async function createTestDatabase() {
  const db = new PGlite();
  // Emulate Supabase-owned schemas only. The actual migration and RLS run unchanged.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
      created_at timestamptz not null default clock_timestamp(), invited_at timestamptz, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select on storage.objects to anon, authenticated;
  `);
  const migrations = (await readdir('supabase/migrations')).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  for (const name of migrations) await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  return db;
}
