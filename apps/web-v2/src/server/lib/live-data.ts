import 'server-only';

/** True when env validation is skipped (local dev without credentials). */
export function isSkipEnvValidation(): boolean {
  return (
    process.env['SKIP_ENV_VALIDATION'] === 'true' ||
    process.env['NEXT_PUBLIC_SKIP_ENV_VALIDATION'] === 'true'
  );
}

/** Whether Supabase anon credentials are present for live reads. */
export function canUseLiveSupabase(): boolean {
  if (isSkipEnvValidation()) return false;
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  return typeof url === 'string' && url.length > 0 && typeof key === 'string' && key.length > 0;
}
