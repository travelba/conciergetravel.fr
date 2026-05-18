import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Temporary diagnostic endpoint to investigate why Vercel preview shows 0
 * destinations despite the production Supabase containing data. Token-gated
 * by `REVALIDATE_SECRET` (already required env) so it isn't world-readable.
 *
 * MUST be removed once the destinations issue is resolved.
 * Tracked via TODO `diag-cleanup` in the active session.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');
  if (!token || token !== env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 1) Reveal which Supabase instance the deployed bundle thinks it's talking
  // to (URL only — the anon key is public anyway, the service role isn't
  // exposed). Lets us spot env mismatch between preview and production.
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHost = (() => {
    try {
      return new URL(url).host;
    } catch {
      return 'invalid-url';
    }
  })();
  const serviceRoleKeyLength = env.SUPABASE_SERVICE_ROLE_KEY.length;
  const serviceRoleKeyPrefix = env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 6);

  // 2) Try a count(*) on `hotels` via the service-role client. Bypasses RLS,
  // so any non-zero count proves the credentials reach the right project.
  let countResult: {
    ok: boolean;
    count: number | null;
    publishedCount: number | null;
    errorMessage: string | null;
    errorCode: string | null;
  };
  try {
    const supabase = getSupabaseAdminClient();
    const [all, published] = await Promise.all([
      supabase.from('hotels').select('id', { head: true, count: 'exact' }),
      supabase
        .from('hotels')
        .select('id', { head: true, count: 'exact' })
        .eq('is_published', true),
    ]);
    countResult = {
      ok: all.error === null && published.error === null,
      count: all.count,
      publishedCount: published.count,
      errorMessage: all.error?.message ?? published.error?.message ?? null,
      errorCode: all.error?.code ?? published.error?.code ?? null,
    };
  } catch (e) {
    countResult = {
      ok: false,
      count: null,
      publishedCount: null,
      errorMessage: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      errorCode: 'EXCEPTION',
    };
  }

  return NextResponse.json(
    {
      ok: true,
      supabase: {
        host: supabaseHost,
        serviceRoleKeyLength,
        serviceRoleKeyPrefix,
      },
      countResult,
      vercelEnv: process.env['VERCEL_ENV'] ?? null,
      vercelGitCommit: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? null,
      nodeEnv: process.env['NODE_ENV'] ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
