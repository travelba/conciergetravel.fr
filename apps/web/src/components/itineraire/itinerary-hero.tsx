import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import type { Locale } from '@/i18n/routing';

interface ItineraryHeroProps {
  readonly locale: Locale;
  readonly title: string;
  readonly eyebrow: string;
  readonly factualSummary: string | null;
  readonly heroImageUrl: string | null;
  readonly heroAlt: string | null;
  readonly lastUpdated: string;
  /** Pre-formatted localised duration label (e.g. "3 jours", "5–7 jours"). */
  readonly durationLabel: string;
  /** Pre-formatted localised destination label (city · country / region). */
  readonly destinationLabel: string;
  /** Localised travel-style label (e.g. "Luxe", "Couple"). */
  readonly travelStyleLabel: string;
}

/**
 * Hotel-detail-style hero for `/itineraire/[slug]` (CDC §6 — fiche
 * éditoriale long-form).
 *
 * Cloudinary delivery URL is computed by the parent (the page reads
 * `env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` once and passes the fully
 * qualified URL down) so this Server Component stays env-free —
 * mirrors the `<HotelImage>` wrapper convention in `@mch/ui`.
 *
 * `<LastUpdatedBadge />` carries the freshness signal (triple-sync:
 * UI ↔ JSON-LD `dateModified` ↔ sitemap `<lastmod>`).
 */
export function ItineraryHero({
  locale,
  title,
  eyebrow,
  factualSummary,
  heroImageUrl,
  heroAlt,
  lastUpdated,
  durationLabel,
  destinationLabel,
  travelStyleLabel,
}: ItineraryHeroProps) {
  return (
    <header className="mb-10">
      {heroImageUrl !== null ? (
        <div className="border-border bg-muted/10 mb-6 overflow-hidden rounded-lg border">
          {/* Plain <img> over next/image: hero URL is already a fully-qualified
              Cloudinary delivery URL (`f_auto,q_auto`) — next/image's loader
              would force a `/_next/image` proxy that breaks the CDN cache. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt={heroAlt ?? title}
            width={1600}
            height={900}
            className="aspect-[16/9] w-full object-cover"
            decoding="async"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      ) : null}

      <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{eyebrow}</p>
      <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{title}</h1>

      <ul className="text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <li>{durationLabel}</li>
        <li aria-hidden>·</li>
        <li>{destinationLabel}</li>
        <li aria-hidden>·</li>
        <li>{travelStyleLabel}</li>
      </ul>

      {factualSummary !== null && factualSummary.length > 0 ? (
        <p
          data-aeo="factual-summary"
          className="text-fg/85 mt-4 max-w-3xl border-l-2 border-amber-300/60 pl-4 text-sm md:text-base"
        >
          {factualSummary}
        </p>
      ) : null}

      <LastUpdatedBadge isoDate={lastUpdated} locale={locale} variant="inline" />
    </header>
  );
}
