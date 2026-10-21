import { writeFile } from 'node:fs/promises';
import { createTestDatabase } from './lib/local-database.mjs';

const db = await createTestDatabase();
try {
  const { rows: columns } = await db.query(`select table_name, column_name, udt_name, is_nullable, column_default
    from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`);
  const { rows: enums } = await db.query(`select t.typname, e.enumlabel from pg_type t
    join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' order by t.typname, e.enumsortorder`);
  const { rows: keys } = await db.query(`select tc.table_name, tc.constraint_name, kcu.column_name,
    ccu.table_name as referenced_table, ccu.column_name as referenced_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and ccu.table_schema = 'public'`);
  const enumNames = new Set(enums.map(row => row.typname));
  const mapType = column => {
    const base = enumNames.has(column.udt_name) ? `Database["public"]["Enums"]["${column.udt_name}"]`
      : ['numeric', 'float8', 'int8', 'int4'].includes(column.udt_name) ? 'number'
      : column.udt_name === 'bool' ? 'boolean' : ['json','jsonb'].includes(column.udt_name) ? 'Json' : 'string';
    return base + (column.is_nullable === 'YES' ? ' | null' : '');
  };
  let output = '// Generated from applied migrations in embedded PostgreSQL.\n// Regenerate: npm run db:types. Do not edit by hand.\n\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\nexport type Database = {\n  public: {\n    Tables: {\n';
  for (const table of new Set(columns.map(row => row.table_name))) {
    const fields = columns.filter(row => row.table_name === table);
    output += `      ${table}: {\n`;
    for (const shape of ['Row', 'Insert', 'Update']) {
      output += `        ${shape}: {\n`;
      for (const field of fields) {
        const optional = shape === 'Update' || (shape === 'Insert' && (field.column_default !== null || field.is_nullable === 'YES'));
        output += `          ${field.column_name}${optional ? '?' : ''}: ${mapType(field)};\n`;
      }
      output += '        };\n';
    }
    output += '        Relationships: [\n';
    for (const key of keys.filter(row => row.table_name === table)) {
      output += `          { foreignKeyName: "${key.constraint_name}"; columns: ["${key.column_name}"]; isOneToOne: false; referencedRelation: "${key.referenced_table}"; referencedColumns: ["${key.referenced_column}"] },\n`;
    }
    output += '        ];\n      };\n';
  }
  const { rows: functions } = await db.query(`select p.proname, p.proargnames, p.proargtypes::oid[] as argtypes,
    rt.typname as return_type from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_type rt on rt.oid=p.prorettype where n.nspname='public' and p.prokind='f' order by p.proname`);
  const { rows: pgTypes } = await db.query('select oid, typname from pg_type');
  const typesById = new Map(pgTypes.map(row => [row.oid, row.typname]));
  output += '    };\n    Views: { [_ in never]: never };\n    Functions: {\n';
  for (const fn of functions) {
    // PostgreSQL function arguments accept NULL; each RPC enforces required values itself.
    const args = (fn.proargnames ?? []).map((name, index) => `${name}: ${mapType({udt_name: typesById.get(fn.argtypes[index]), is_nullable: 'YES'})}`).join('; ');
    const argsType = args ? `{ ${args} }` : 'Record<string, never>';
    output += `      ${fn.proname}: { Args: ${argsType}; Returns: ${mapType({udt_name: fn.return_type})} };\n`;
  }
  output += '    };\n    Enums: {\n';
  for (const name of enumNames) output += `      ${name}: ${enums.filter(row => row.typname === name).map(row => JSON.stringify(row.enumlabel)).join(' | ')};\n`;
  output += '    };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n';
  await writeFile('src/types/database.ts', output);
  console.log('Generated src/types/database.ts from six migrated PostgreSQL tables.');
} finally { await db.close(); }
