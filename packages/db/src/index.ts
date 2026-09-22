/**
 * @mch/db — public surface.
 * Schema (Drizzle types) + supabase admin client factory.
 * Migrations live under ./migrations/*.sql, executed via scripts/migrate.ts.
 */
export * from './schema/index';
export * from './v2/index';
export { createSupabaseAdminClient, type SupabaseAdminClient } from './client';
