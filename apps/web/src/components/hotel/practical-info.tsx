import type React from 'react';

/**
 * "Concierge handoff" practical block — the same info a concierge would
 * email a guest about a cited venue or place: opening hours, indicative
 * price, phone, address, an official-website link, a reservation button
 * and a one-line concierge tip.
 *
 * Pure presentational RSC: it receives already-translated `labels` so it
 * stays framework-agnostic and reusable by both `HotelRestaurants` and
 * `HotelLocation`. Every field is optional — the block renders only the
 * rows that are populated, and the whole component self-elides when there
 * is nothing useful to show.
 *
 * Outbound links carry `rel="nofollow noopener noreferrer"` + `target`
 * `_blank` (third-party destinations we don't vouch for, SEO-neutral).
 *
 * Progressive disclosure (2026-06-01): the dossier is wrapped in a native
 * `<details>` so it is collapsed by default — keeps the venue/POI cards
 * scannable without hiding anything from crawlers. The body stays in the
 * DOM (Google indexes closed `<details>`), the `<summary>` carries a
 * citable preview (hours · price) so GEO/LLM ingestion keeps the key
 * facts even when the block is folded, and there is zero client JS
 * (a11y-friendly, keyboard-operable). Structured data for agents lives in
 * the page JSON-LD, untouched by this UI affordance.
 */

export interface PracticalInfoLabels {
  readonly title: string;
  readonly hoursLabel: string;
  readonly priceLabel: string;
  readonly phoneLabel: string;
  readonly addressLabel: string;
  readonly mustOrderLabel?: string;
  readonly website: string;
  readonly reserve: string;
  readonly conciergeTip: string;
}

export interface PracticalInfoProps {
  readonly hours?: string | null;
  readonly priceNote?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly mustOrder?: string | null;
  readonly website?: string | null;
  readonly reservationUrl?: string | null;
  readonly tip?: string | null;
  readonly labels: PracticalInfoLabels;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

export function PracticalInfo({
  hours = null,
  priceNote = null,
  phone = null,
  address = null,
  mustOrder = null,
  website = null,
  reservationUrl = null,
  tip = null,
  labels,
}: PracticalInfoProps): React.ReactElement | null {
  const showMustOrder = mustOrder !== null && labels.mustOrderLabel !== undefined;
  const hasFacts =
    hours !== null || priceNote !== null || phone !== null || address !== null || showMustOrder;
  const hasLinks = website !== null || reservationUrl !== null;

  if (!hasFacts && !hasLinks && tip === null) return null;

  // Citable preview rendered inside the always-visible <summary>: the most
  // quotable facts (hours · price) stay in the DOM even when collapsed, so
  // GEO/LLM crawlers that skip closed <details> bodies still see them.
  const preview = [hours, priceNote].filter((v): v is string => v !== null).join(' · ');

  return (
    <details className="border-border/70 group mt-3 border-t pt-3">
      <summary className="text-muted hover:text-fg flex cursor-pointer select-none list-none items-center gap-2 text-xs font-medium uppercase tracking-wide [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          className="shrink-0 transition-transform group-open:rotate-90"
        >
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>{labels.title}</span>
        {preview !== '' ? (
          <span className="text-muted/80 truncate normal-case tracking-normal">— {preview}</span>
        ) : null}
      </summary>

      <div className="mt-3">
        {hasFacts ? (
          <dl className="text-fg grid gap-1 text-sm">
            {hours !== null ? (
              <div className="flex gap-1.5">
                <dt className="text-muted shrink-0">{labels.hoursLabel} :</dt>
                <dd>{hours}</dd>
              </div>
            ) : null}
            {priceNote !== null ? (
              <div className="flex gap-1.5">
                <dt className="text-muted shrink-0">{labels.priceLabel} :</dt>
                <dd>{priceNote}</dd>
              </div>
            ) : null}
            {showMustOrder ? (
              <div className="flex gap-1.5">
                <dt className="text-muted shrink-0">{labels.mustOrderLabel} :</dt>
                <dd className="font-medium">{mustOrder}</dd>
              </div>
            ) : null}
            {phone !== null ? (
              <div className="flex gap-1.5">
                <dt className="text-muted shrink-0">{labels.phoneLabel} :</dt>
                <dd>
                  <a className="hover:underline" href={telHref(phone)}>
                    {phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {address !== null ? (
              <div className="flex gap-1.5">
                <dt className="text-muted shrink-0">{labels.addressLabel} :</dt>
                <dd>{address}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {hasLinks ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {reservationUrl !== null ? (
              <a
                href={reservationUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="bg-fg text-bg inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium hover:opacity-90"
              >
                {labels.reserve}
              </a>
            ) : null}
            {website !== null ? (
              <a
                href={website}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="border-border text-fg hover:bg-bg inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                {labels.website}
              </a>
            ) : null}
          </div>
        ) : null}

        {tip !== null ? (
          <p className="text-fg bg-bg/60 border-border/60 mt-2 rounded-md border px-3 py-2 text-sm italic">
            <span className="text-muted not-italic">{labels.conciergeTip} — </span>
            {tip}
          </p>
        ) : null}
      </div>
    </details>
  );
}
