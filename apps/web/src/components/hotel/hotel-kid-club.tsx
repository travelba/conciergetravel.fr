import { HotelImage } from '@mch/ui';
import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedSignatureExperience } from '@/server/hotels/get-hotel-by-slug';

interface HotelKidClubProps {
  readonly locale: SupportedLocale;
  readonly cloudName: string;
  readonly experiences: readonly LocalisedSignatureExperience[];
}

/**
 * Kid Club feature block — kit `template-hotel.html` § « L'hôtel en bref » (D4).
 *
 * `kid_club`-typed `signature_experiences` entries are surfaced here as the
 * kit `.feature-block` (image + serif title + lede + meta + footer), instead
 * of the generic signature grid. The block self-elides when no `kid_club`
 * entry exists (current Airelles state — content sourced in Phase 3).
 *
 * a11y: each block is an `<article>` headed by an `<h3>` (the container
 * « L'hôtel en bref » owns the `<h2>`); the badge is a visible meta line, the
 * booking note is text (no icon-only conveyance). Alternating `reverse`
 * keeps the media/text rhythm when several Kid Clubs are declared.
 *
 * Skill: content-modeling, geo-llm-optimization, accessibility, responsive-ui.
 */
export async function HotelKidClub({
  locale,
  cloudName,
  experiences,
}: HotelKidClubProps): Promise<React.ReactElement | null> {
  const kidClubs = experiences.filter((e) => e.kind === 'kid_club');
  if (kidClubs.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  return (
    <div className="mch-kit">
      {kidClubs.map((exp, idx) => (
        <article
          key={exp.key}
          id={`kid-club-${exp.key}`}
          aria-label={exp.title}
          className={idx % 2 === 1 ? 'feature-block reverse' : 'feature-block'}
          style={idx > 0 ? { marginTop: '22px' } : undefined}
        >
          {exp.imagePublicId !== null ? (
            <div className="fb-media-solo">
              <HotelImage
                cloudName={cloudName}
                publicId={exp.imagePublicId}
                alt={exp.title}
                width={720}
                height={560}
                variant="card"
                className="h-full w-full"
              />
            </div>
          ) : null}
          <div className="fb-tx">
            <h3>{exp.title}</h3>
            <p>{exp.description}</p>
            {exp.badge !== null ? (
              <ul className="fb-meta">
                <li>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{exp.badge}</span>
                </li>
              </ul>
            ) : null}
            <div
              className="fb-price"
              data-booking-required={exp.bookingRequired ? 'true' : 'false'}
            >
              {exp.bookingRequired
                ? t('signatureExperiences.bookingRequired')
                : t('signatureExperiences.includedInStay')}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
