/**
 * Direct Supabase Postgres (`db.<ref>.supabase.co`) is IPv6-only on many
 * projects and ENOENT/ENOTFOUND on Windows or corporate networks. Audit
 * scripts prefer `pg` when DATABASE_URL is set but fall back to PostgREST
 * (NEXT_PUBLIC_SUPABASE_URL + service role) when the TCP host is unreachable.
 */

const UNREACHABLE_PG_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

export function isDirectPgUnreachable(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; errno?: unknown; message?: unknown };
  if (typeof e.code === 'string' && UNREACHABLE_PG_CODES.has(e.code)) return true;
  if (typeof e.errno === 'number' && e.errno === -3008) return true; // Windows ENOTFOUND
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return (
    msg.includes('getaddrinfo') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('connect timeout') ||
    msg.includes('connection terminated')
  );
}

export function auditForcePostgrest(): boolean {
  return (process.env['MCH_AUDIT_FORCE_REST'] ?? '').length > 0;
}

export function hasPgConnectionString(): boolean {
  return (
    (process.env['DATABASE_URL'] ?? '').length > 0 ||
    (process.env['SUPABASE_DB_POOLER_URL'] ?? '').length > 0 ||
    (process.env['SUPABASE_DB_URL'] ?? '').length > 0
  );
}

export function warnPgFallback(script: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.warn(`[${script}] Direct Postgres unreachable (${detail}); falling back to PostgREST.`);
}
