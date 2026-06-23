/**
 * Applies a SINGLE migration file by name, idempotently, recording it in the
 * `public._cct_sql_migrations` ledger. Use when the bulk runner (`migrate.ts`)
 * is unsafe — e.g. the live DB was historically migrated via the Supabase MCP
 * so the ledger doesn't list the earlier files, and a full run would re-apply
 * them. Migrations themselves should be idempotent (`if not exists`,
 * `drop policy if exists`) so a re-run is harmless.
 *
 * Connection: prefers `SUPABASE_DB_URL`, falls back to `DATABASE_URL` (use a
 * DIRECT Postgres URI on port 5432 for DDL, not the pooled PgBouncer).
 *
 * Usage (from repo root, loading the local env):
 *   node --env-file=.env.local --import tsx \
 *     packages/db/scripts/apply-migration-file.ts 0077_contact_requests.sql
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { z } from 'zod';

const Env = z.object({
  dbUrl: z
    .string()
    .min(1)
    .refine(
      (s) => s.startsWith('postgresql://') || s.startsWith('postgres://'),
      'connection string must be a Postgres URI',
    ),
});

const scriptDir = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg === undefined || arg.length === 0) {
    console.error('Usage: apply-migration-file.ts <filename.sql>');
    process.exitCode = 1;
    return;
  }
  const filename = arg.endsWith('.sql') ? arg : `${arg}.sql`;

  const parsed = Env.safeParse({
    dbUrl: process.env['SUPABASE_DB_URL'] ?? process.env['DATABASE_URL'],
  });
  if (!parsed.success) {
    console.error('Invalid env (need SUPABASE_DB_URL or DATABASE_URL):', parsed.error.flatten());
    process.exitCode = 1;
    return;
  }

  const migrationsDir = join(scriptDir, '../migrations');
  const available = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql'));
  if (!available.includes(filename)) {
    console.error(`[migrate:one] not found: ${filename}`);
    process.exitCode = 1;
    return;
  }

  const sqlConnection = postgres(parsed.data.dbUrl, { max: 1, onnotice: () => undefined });
  try {
    await sqlConnection`
      create table if not exists public._cct_sql_migrations (
        filename text primary key,
        applied_at timestamptz not null default timezone('utc', now())
      )
    `;

    const already = await sqlConnection`
      select 1 from public._cct_sql_migrations where filename = ${filename}
    `;
    if (already.length > 0) {
      console.info(`[migrate:one] skip (already applied) ${filename}`);
      return;
    }

    const body = await readFile(join(migrationsDir, filename), 'utf8');
    await sqlConnection.begin(async (txn) => {
      await txn.unsafe(body);
      await txn`insert into public._cct_sql_migrations (filename) values (${filename})`;
    });
    console.info(`[migrate:one] applied ${filename}`);
  } catch (error) {
    console.error('[migrate:one] failed:', error);
    process.exitCode = 1;
  } finally {
    await sqlConnection.end({ timeout: 5 });
  }
}

void main().catch((error) => {
  console.error('[migrate:one] unhandled:', error);
  process.exit(1);
});
