import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Temporary, defensive diagnostic endpoint to investigate why the Vercel
 * preview shows 0 destinations while the production Supabase contains 73
 * cities / 106 published hotels.
 *
 * NOTE: Next.js App Router treats folders prefixed with `_` as private and
 * does NOT expose them. Hence `app/api/diag/supabase/route.ts` (no leading
 * underscore on `diag`).
 *
 * Reads `process.env` directly (NOT `@/lib/env`) so a missing env value
 * doesn't blow up the route before we can report it. Token gating uses a
 * hard-coded UUID because the local `REVALIDATE_SECRET` differs from the
 * Vercel preview env.
 *
 * MUST be removed once the destinations issue is resolved.
 * Tracked via TODO `diag-cleanup` in the active session.
 */
const DIAG_TOKEN = '8c9f2e1d-4b6a-4a2f-9e7c-3b5d1a8f6e2c-mch-2026-05';

function describe(value: string | undefined): {
  present: boolean;
  length: number;
  prefix: string;
} {
  if (typeof value !== 'string' || value.length === 0) {
    return { present: false, length: 0, prefix: '' };
  }
  return { present: true, length: value.length, prefix: value.slice(0, 6) };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== DIAG_TOKEN) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

  const envReport = {
    NEXT_PUBLIC_SUPABASE_URL: describe(supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: describe(serviceKey),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: describe(anonKey),
    SUPABASE_DB_URL_present: typeof process.env['SUPABASE_DB_URL'] === 'string',
    REVALIDATE_SECRET_present: typeof process.env['REVALIDATE_SECRET'] === 'string',
  };

  const supabaseHost = (() => {
    try {
      return new URL(supabaseUrl).host;
    } catch {
      return null;
    }
  })();

  let countResult:
    | {
        ok: true;
        count: number | null;
        publishedCount: number | null;
        keyKind: 'service-role' | 'anon';
      }
    | {
        ok: false;
        keyKind: 'service-role' | 'anon';
        errorMessage: string;
        errorCode: string | null;
      };

  const usingServiceRole = serviceKey.length > 0;
  const keyForClient = usingServiceRole ? serviceKey : anonKey;

  if (supabaseUrl.length === 0 || keyForClient.length === 0) {
    countResult = {
      ok: false,
      keyKind: usingServiceRole ? 'service-role' : 'anon',
      errorMessage: 'NO_URL_OR_KEY',
      errorCode: null,
    };
  } else {
    try {
      const supa = createClient(supabaseUrl, keyForClient, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const [all, published] = await Promise.all([
        supa.from('hotels').select('id', { head: true, count: 'exact' }),
        supa
          .from('hotels')
          .select('id', { head: true, count: 'exact' })
          .eq('is_published', true),
      ]);
      if (all.error !== null || published.error !== null) {
        countResult = {
          ok: false,
          keyKind: usingServiceRole ? 'service-role' : 'anon',
          errorMessage: all.error?.message ?? published.error?.message ?? 'unknown',
          errorCode: all.error?.code ?? published.error?.code ?? null,
        };
      } else {
        countResult = {
          ok: true,
          count: all.count,
          publishedCount: published.count,
          keyKind: usingServiceRole ? 'service-role' : 'anon',
        };
      }
    } catch (e) {
      countResult = {
        ok: false,
        keyKind: usingServiceRole ? 'service-role' : 'anon',
        errorMessage: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        errorCode: 'EXCEPTION',
      };
    }
  }

  return NextResponse.json(
    {
      ok: true,
      envReport,
      supabaseHost,
      countResult,
      vercelEnv: process.env['VERCEL_ENV'] ?? null,
      vercelGitCommit: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? null,
      nodeEnv: process.env['NODE_ENV'] ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
