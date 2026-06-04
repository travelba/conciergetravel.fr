import { NextResponse, type NextRequest } from 'next/server';

import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { setDraftCookie } from '@/server/booking/draft-cookie';
import { lockTravelportSandboxOffer } from '@/server/booking/travelport-offer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Point d'entrée **sandbox** du pilote Travelport (Phase 6, Étape A).
 *
 * GET `/[locale]/reservation/sandbox/[slug]` :
 *   1. gated — n'existe que si `TRAVELPORT_SANDBOX_ENABLED` ET slug allow-listé
 *      (sinon 404, pour ne pas révéler la route) ;
 *   2. recherche Travelport + match → `Offer` domaine (EUR) → draft `recap` ;
 *   3. pose le cookie draft et redirige vers le **recap existant**.
 *
 * Ne touche ni la fiche publique ni `booking_mode` : le gel Phase 6 reste
 * piloté par la donnée. Aucune réservation n'est créée (Étape A).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ locale: string; slug: string }> },
): Promise<NextResponse> {
  const { locale: rawLocale, slug: rawSlug } = await ctx.params;
  const locale: Locale = isRoutingLocale(rawLocale) ? rawLocale : 'fr';
  const slug = decodeURIComponent(rawSlug ?? '');

  const result = await lockTravelportSandboxOffer({ slug, locale });
  if (!result.ok) {
    // 404 quand le pilote est désactivé / slug non allow-listé : la route ne
    // doit pas exister publiquement. Les autres échecs (pas de tarif, pas de
    // match) renvoient vers la recherche avec un drapeau d'erreur.
    if (result.reason === 'disabled') {
      return new NextResponse('Not Found', { status: 404 });
    }
    const back = new URL(getPathname({ locale, href: '/recherche' }), req.nextUrl.origin);
    back.searchParams.set('error', `travelport_${result.reason}`);
    return NextResponse.redirect(back, 303);
  }

  await setDraftCookie(result.draftId, result.ttlSec);
  const recap = new URL(getPathname({ locale, href: '/reservation/recap' }), req.nextUrl.origin);
  return NextResponse.redirect(recap, 303);
}
