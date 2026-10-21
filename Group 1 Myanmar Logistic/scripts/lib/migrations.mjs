import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function applyMigrations(query) {
  const files = (await readdir('supabase/migrations')).filter(file => /^\d+_[a-z_]+\.sql$/.test(file)).sort();
  const journal = await query("select to_regclass('supabase_migrations.schema_migrations') as journal");
  const history = journal[0]?.journal ? await query('select version, statements from supabase_migrations.schema_migrations') : [];
  const known = new Set(files.map(file => file.split('_')[0]));
  if (history.some(row => !known.has(row.version))) throw new Error('Remote migration history contains an unknown version. Review before applying changes.');
  for (const file of files) {
    const [version] = file.split('_');
    const name = file.slice(version.length + 1, -4);
    const migration = await readFile(`supabase/migrations/${file}`, 'utf8');
    const digest = createHash('sha256').update(migration).digest('hex');
    const applied = history.find(row => row.version === version);
    if (applied) {
      if (!applied.statements?.join('\n').includes(`-- sha256:${digest}`)) throw new Error(`Applied migration checksum differs: ${file}.`);
      console.log(`Already applied: ${file}`);
      continue;
    }
    if (history.length === 0 && file === files[0]) {
      const existing = await query("select table_name from information_schema.tables where table_schema='public' and table_name in ('profiles','shipments','shipment_updates','gate_statuses','alerts','documents')");
      if (existing.length) throw new Error('Application tables exist without matching migration history. No tables were replaced.');
    }
    const statement = `-- sha256:${digest}\n${migration}`;
    if (statement.includes('$migration_body$')) throw new Error('Unexpected migration delimiter.');
    await query(`begin;
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);
      ${migration}
      insert into supabase_migrations.schema_migrations(version, statements, name)
      values ('${version}', array[$migration_body$${statement}$migration_body$], '${name}');
      commit;`);
    console.log(`Applied: ${file}`);
  }
}
