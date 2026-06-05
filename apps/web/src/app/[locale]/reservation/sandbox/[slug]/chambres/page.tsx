import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { BookingProgress } from '@/components/booking/booking-progress';
import { SubmitButton } from '@/components/booking/submit-button';
import { BookingSandboxDateFields } from '@/components/hotel/booking-sandbox-date-fields';
import { Link, getPathname, redirect } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { setDraftCookie } from '@/server/booking/draft-cookie';
import { gateTravelportSearchByIp } from '@/server/booking/rate-limit';
import {
  listTravelportSandboxOffers,
  lockTravelportSandboxSelectedOffer,
  matchEditorialRoomImages,
} from '@/server/booking/travelport-offer';
import { getHotelBySlug } from '@/server/hotels/get-hotel-by-slug';

import { RoomsList } from './rooms-list';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = { robots: { index: false, follow: false } };

function clientIp(h: { get(name: string): string | null }): string {
  const xff = h.get('x-forwarded-for');
  if (xff !== null && xff.length > 0) {
    const first = xff.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  return h.get('x-real-ip') ?? '0.0.0.0';
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Verrouille le tarif choisi (offerSetId + rateKey relus côté serveur depuis le
 * cache Redis — jamais le prix client) puis redirige vers la saisie voyageur
 * (`/reservation/invite`) où le client renseigne sa vraie identité. En cas
 * d'échec, retour sur la **fiche pilote** (état lisible) plutôt que vers la
 * recherche legacy qui n'exploite pas ce drapeau.
 */
async function selectRoomAction(formData: FormData): Promise<void> {
  'use server';

  const offerSetId = formData.get('offerSetId');
  const rateKey = formData.get('rateKey');
  const rawLocale = formData.get('locale');
  const rawSlug = formData.get('slug');
  const locale: Locale =
    typeof rawLocale === 'string' && isRoutingLocale(rawLocale) ? rawLocale : 'fr';
  const slug = typeof rawSlug === 'string' ? rawSlug : '';

  // Erreur lisible côté fiche pilote (jamais la recherche legacy).
  const backHref =
    slug !== '' ? ({ pathname: '/hotel/[slug]', params: { slug } } as const) : ('/' as const);

  if (typeof offerSetId !== 'string' || typeof rateKey !== 'string') {
    redirect({ href: backHref, locale });
  }

  const result = await lockTravelportSandboxSelectedOffer({ offerSetId, rateKey, locale });
  if (!result.ok) {
    redirect({ href: backHref, locale });
  }

  await setDraftCookie(result.draftId, result.ttlSec);
  redirect({ href: '/reservation/invite', locale });
}

export default async function TravelportSandboxRoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    adults?: string;
  }>;
}) {
  const [{ locale: rawLocale, slug: rawSlug }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const slug = decodeURIComponent(rawSlug ?? '');
  const t = await getTranslations({ locale, namespace: 'reservationRooms' });

  // Rate-limit la recherche temps réel (appel Travelport pluri-seconde).
  const verdict = await gateTravelportSearchByIp(clientIp(await headers()));
  if (!verdict.ok) {
    return (
      <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('tooManyRequests.title')}</h1>
        <p className="text-muted mt-3 max-w-prose">{t('tooManyRequests.description')}</p>
      </main>
    );
  }

  const result = await listTravelportSandboxOffers({
    slug,
    locale,
    stay: { checkIn: sp.checkIn, checkOut: sp.checkOut, adults: sp.adults },
  });

  // Pilote désactivé / slug non allow-listé : la route ne doit pas exister.
  if (!result.ok && result.reason === 'disabled') notFound();

  if (!result.ok) {
    return (
      <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('noAvailability.title')}</h1>
        <p className="text-muted mt-3 max-w-prose">{t('noAvailability.description')}</p>
        <p className="mt-6">
          <Link
            href={{ pathname: '/hotel/[slug]', params: { slug } }}
            className="text-fg font-medium underline-offset-2 hover:underline"
          >
            {t('noAvailability.back')} <span aria-hidden>→</span>
          </Link>
        </p>
      </main>
    );
  }

  const nights = (() => {
    const a = Date.parse(`${result.checkIn}T00:00:00Z`);
    const b = Date.parse(`${result.checkOut}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
    return Math.round((b - a) / 86_400_000);
  })();

  const dateFormAction = getPathname({
    locale,
    href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
  });

  // Photo éditoriale par libellé de chambre Travelport — on réutilise les
  // chambres éditoriales de la fiche (mêmes hero images que les cartes) et on
  // les rapproche par recouvrement de tokens. Best-effort : sans correspondance
  // la carte reste sans photo (jamais cassée). Lecture DB supplémentaire
  // acceptable sur une page déjà `force-dynamic`.
  const editorialHotel = await getHotelBySlug(slug, locale);
  const roomImageMatches = matchEditorialRoomImages({
    roomLabels: result.options.map((o) => o.roomLabel),
    rooms: editorialHotel?.rooms ?? [],
  });
  const imagesByLabel: Record<string, { readonly publicId: string; readonly alt: string }> = {};
  for (const [label, ref] of roomImageMatches) imagesByLabel[label] = ref;

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      <BookingProgress locale={locale} current="rooms" />
      <header className="border-border from-gold-50 to-bg mb-8 rounded-2xl border bg-gradient-to-br px-6 py-7">
        <p className="text-gold-700 text-xs font-medium uppercase tracking-[0.18em]">
          {t('eyebrow')}
        </p>
        <h1 className="text-fg mt-2 font-serif text-3xl sm:text-4xl">{result.hotelName}</h1>
        <p className="text-muted mt-2 flex flex-wrap items-center gap-x-2 text-sm">
          <span className="text-fg font-medium">
            {result.checkIn} → {result.checkOut}
          </span>
          <span aria-hidden className="text-gold-400">
            ·
          </span>
          {t('stayLine', { nights, adults: result.adults })}
        </p>
      </header>

      {result.datesAdjusted ? (
        <p
          role="status"
          className="border-gold-200 bg-gold-50 text-gold-900 mb-6 rounded-md border px-3 py-2 text-sm"
        >
          {t('datesAdjusted', { checkIn: result.checkIn, checkOut: result.checkOut })}
        </p>
      ) : null}

      <form
        method="get"
        action={dateFormAction}
        className="border-border bg-bg mb-8 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <BookingSandboxDateFields
            labels={{
              checkIn: t('dates.checkIn'),
              checkOut: t('dates.checkOut'),
              adults: t('dates.adults'),
            }}
            defaults={{ checkIn: result.checkIn, checkOut: result.checkOut, adults: result.adults }}
            today={addDaysIso(0)}
          />
        </div>
        <SubmitButton
          pendingLabel={t('dates.updating')}
          className="bg-fg text-bg focus-visible:ring-ring shrink-0 rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70"
        >
          {t('dates.update')}
        </SubmitButton>
      </form>

      <RoomsList
        options={result.options}
        offerSetId={result.offerSetId}
        slug={slug}
        locale={locale}
        nights={nights}
        cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
        imagesByLabel={imagesByLabel}
        selectAction={selectRoomAction}
      />

      <p className="text-muted/80 mt-6 text-xs">{t('preprodNote')}</p>
    </main>
  );
}
