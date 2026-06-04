import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { redirect } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';
import { setDraftCookie } from '@/server/booking/draft-cookie';
import {
  listTravelportSandboxOffers,
  lockTravelportSandboxSelectedOffer,
} from '@/server/booking/travelport-offer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = { robots: { index: false, follow: false } };

const fmtPrice = (locale: Locale, amountMinor: number): string =>
  new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);

/**
 * Verrouille le tarif choisi (offerSetId + rateKey relus côté serveur depuis le
 * cache Redis — jamais le prix client) puis redirige vers le recap existant.
 */
async function selectRoomAction(formData: FormData): Promise<void> {
  'use server';

  const offerSetId = formData.get('offerSetId');
  const rateKey = formData.get('rateKey');
  const rawLocale = formData.get('locale');
  const locale: Locale =
    typeof rawLocale === 'string' && isRoutingLocale(rawLocale) ? rawLocale : 'fr';

  if (typeof offerSetId !== 'string' || typeof rateKey !== 'string') {
    redirect({ href: '/recherche', locale });
  }

  const result = await lockTravelportSandboxSelectedOffer({ offerSetId, rateKey, locale });
  if (!result.ok) {
    redirect({
      href: { pathname: '/recherche', query: { error: `travelport_${result.reason}` } },
      locale,
    });
  }

  await setDraftCookie(result.draftId, result.ttlSec);
  redirect({ href: '/reservation/recap', locale });
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
    children?: string;
  }>;
}) {
  const [{ locale: rawLocale, slug: rawSlug }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const en = locale === 'en';
  const slug = decodeURIComponent(rawSlug ?? '');

  const result = await listTravelportSandboxOffers({
    slug,
    locale,
    stay: {
      checkIn: sp.checkIn,
      checkOut: sp.checkOut,
      adults: sp.adults,
      children: sp.children,
    },
  });

  // Pilote désactivé / slug non allow-listé : la route ne doit pas exister.
  if (!result.ok && result.reason === 'disabled') notFound();

  if (!result.ok) {
    return (
      <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">
          {en ? 'No availability' : 'Aucune disponibilité'}
        </h1>
        <p className="text-muted mt-3 max-w-prose">
          {en
            ? 'No rooms were returned for these dates. Please try other dates.'
            : 'Aucune chambre disponible pour ces dates. Essayez d’autres dates.'}
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

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-muted text-xs uppercase tracking-[0.18em]">
          {en ? 'Choose your room' : 'Choisissez votre chambre'}
        </p>
        <h1 className="text-fg mt-2 font-serif text-3xl sm:text-4xl">{result.hotelName}</h1>
        <p className="text-muted mt-2 text-sm">
          {result.checkIn} → {result.checkOut} ·{' '}
          {en
            ? `${nights} night${nights > 1 ? 's' : ''}, ${result.adults} adult${result.adults > 1 ? 's' : ''}`
            : `${nights} nuit${nights > 1 ? 's' : ''}, ${result.adults} adulte${result.adults > 1 ? 's' : ''}`}
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {result.options.map((opt) => (
          <li
            key={opt.rateKey}
            className="border-border bg-bg rounded-lg border p-4 sm:p-5"
            data-room-option
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-fg font-serif text-lg leading-snug">{opt.roomLabel}</h2>
                <p className="text-muted mt-1 text-sm">{opt.rateLabel}</p>
                <ul className="text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {opt.maxOccupancy !== null ? (
                    <li>
                      {en
                        ? `Up to ${opt.maxOccupancy} guests`
                        : `Jusqu’à ${opt.maxOccupancy} pers.`}
                    </li>
                  ) : null}
                  {opt.breakfastIncluded === true ? (
                    <li>{en ? 'Breakfast included' : 'Petit-déjeuner inclus'}</li>
                  ) : null}
                  {opt.refundable === true ? (
                    <li>{en ? 'Refundable' : 'Remboursable'}</li>
                  ) : opt.refundable === false ? (
                    <li>{en ? 'Non-refundable' : 'Non remboursable'}</li>
                  ) : null}
                </ul>
                {opt.cancellationText !== '' ? (
                  <p className="text-muted/80 mt-2 text-xs">{opt.cancellationText}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <p className="text-fg font-serif text-2xl">{fmtPrice(locale, opt.priceMinor)}</p>
                <p className="text-muted text-xs">{en ? 'total stay' : 'séjour total'}</p>
                <form action={selectRoomAction}>
                  <input type="hidden" name="offerSetId" value={result.offerSetId} />
                  <input type="hidden" name="rateKey" value={opt.rateKey} />
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="bg-fg text-bg focus-visible:ring-ring rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
                  >
                    {en ? 'Select' : 'Choisir'}
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-muted/80 mt-6 text-xs">
        {en
          ? 'Preprod pilot — no payment is taken at this stage.'
          : 'Pilote preprod — aucun paiement n’est prélevé à ce stade.'}
      </p>
    </main>
  );
}
