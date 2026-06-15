import 'server-only';

import { buildCloudinarySrc } from '@mch/ui';

import type { HotelRoomCardVM } from '@/components/hotel/hotel-rooms-grid';
import { pickProximityCards } from '@/server/hotels/get-related-hotels';

import { getPathname } from '@/i18n/navigation';
import { formatGoogleReviewDate } from '@/lib/format-google-review-date';
import { getMapboxAccessToken } from '@/lib/maps/mapbox-access';

import { buildHotelCountryHubPath } from '@/server/hotels/country-hub-path';

import type { HotelKitModel } from './prepare-hotel-kit-model';
import {
  amenityIconHtml,
  formatKitDistinctionLabel,
  isKitSignatureExperienceConciergePick,
  orderKitSignatureExperiences,
} from './kit-airelles-display';
import { resolveKitAmenityBlocks } from './resolve-kit-amenity-blocks';
import { KIT_GENERIC_ASSETS, resolveKitClubIllustration } from './kit-generic-assets';
import { localizeKitOfficialHref, resolveKitLearnMoreLink } from './kit-learn-more-link';
import {
  escapeHtml,
  escapeProseHtml,
  formatRatingFr,
  formatReviewCount,
  ICON_AREA,
  ICON_BED,
  ICON_CHECK,
  ICON_EMAIL,
  ICON_LOC,
  ICON_PHONE,
  ICON_STAR,
  ICON_STAR_AWARD,
  localePrefix,
  ratingQualitativeLabel,
} from './kit-html-utils';
import type {
  EventCategory,
  LocalisedPointOfInterest,
  LocalisedRestaurantVenue,
  LocalisedUpcomingEvent,
} from '@/server/hotels/get-hotel-by-slug';

const REVIEW_CLAMP_CHARS = 220;

const CAROUSEL_NAV_PREV =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const CAROUSEL_NAV_NEXT =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

function wrapKitDisclosure(options: {
  readonly title: string;
  readonly lede?: string;
  readonly body: string;
  readonly heading?: 'h2' | 'h3';
  readonly className?: string;
  readonly titleId?: string;
}): string {
  const heading = options.heading ?? 'h3';
  const ledePart =
    options.lede !== undefined && options.lede.length > 0
      ? `<p class="sub-lede">${escapeProseHtml(options.lede)}</p>`
      : '';
  const extraClass = options.className !== undefined ? ` ${options.className}` : '';
  const titleIdAttr = options.titleId !== undefined ? ` id="${escapeHtml(options.titleId)}"` : '';
  return `<details class="kit-disclosure${extraClass}" data-default-closed="true">
    <summary class="kit-disclosure__summary">
      <${heading} class="kit-disclosure__title"${titleIdAttr}>${escapeHtml(options.title)}</${heading}>
      <span class="kit-disclosure__chevron" aria-hidden="true"></span>
    </summary>
    <div class="kit-disclosure__body">
      ${ledePart}
      ${options.body}
    </div>
  </details>`;
}

function wrapAccessDisclosure(options: {
  readonly title: string;
  readonly body: string;
  readonly className?: string;
}): string {
  const extraClass = options.className !== undefined ? ` ${options.className}` : '';
  return `<details class="access-disclosure${extraClass}" data-default-closed="true">
    <summary class="access-disclosure__summary">
      <span class="access-disclosure__title">${escapeHtml(options.title)}</span>
      <span class="access-disclosure__chevron" aria-hidden="true"></span>
    </summary>
    <div class="access-disclosure__body">${options.body}</div>
  </details>`;
}

function renderKitCarouselNav(locale: 'fr' | 'en'): string {
  const prevLabel = locale === 'en' ? 'Previous' : 'Précédent';
  const nextLabel = locale === 'en' ? 'Next' : 'Suivant';
  return `<button type="button" class="carousel-nav prev" aria-label="${escapeHtml(prevLabel)}">${CAROUSEL_NAV_PREV}</button>
        <button type="button" class="carousel-nav next" aria-label="${escapeHtml(nextLabel)}">${CAROUSEL_NAV_NEXT}</button>`;
}

function reviewNeedsToggle(text: string): boolean {
  return text.length > REVIEW_CLAMP_CHARS;
}

function renderGoogleReviewCardHtml(
  review: {
    readonly author: string;
    readonly rating: number;
    readonly text: string;
    readonly publishTime: string | null;
  },
  locale: 'fr' | 'en',
  index: number,
): string {
  const publishLabel = formatGoogleReviewDate(review.publishTime, locale);
  const textId = `google-review-text-${index}`;
  const seeMore = locale === 'en' ? 'See more' : 'Voir plus';
  const seeLess = locale === 'en' ? 'See less' : 'Voir moins';
  const clamped = reviewNeedsToggle(review.text);
  const dateHtml =
    publishLabel !== null
      ? `<time class="rv-date" datetime="${escapeHtml(review.publishTime ?? '')}">${escapeHtml(publishLabel)}</time>`
      : '';
  const toggleHtml = clamped
    ? `<button type="button" class="review-toggle btn-ligne" aria-expanded="false" aria-controls="${textId}" data-more="${escapeHtml(seeMore)}" data-less="${escapeHtml(seeLess)}">${escapeHtml(seeMore)}</button>`
    : '';
  return `<blockquote class="review"><div class="rv-top"><span class="rv-score">${formatRatingFr(review.rating)}</span><span class="rv-name">${escapeHtml(review.author)}</span></div>${dateHtml}<p id="${textId}" class="review-text${clamped ? ' is-clamped' : ''}">« ${escapeHtml(review.text)} »</p>${toggleHtml}</blockquote>`;
}

function formatPoiDistanceLabel(
  model: HotelKitModel,
  poi: LocalisedPointOfInterest,
): string | null {
  if (poi.walkMinutes !== null && poi.walkMinutes > 0) {
    return model.locale === 'en' ? `${poi.walkMinutes} min walk` : `${poi.walkMinutes} min à pied`;
  }
  if (poi.distanceMeters >= 1000) {
    const km = (poi.distanceMeters / 1000).toFixed(1).replace('.0', '');
    return model.locale === 'en' ? `${km} km away` : `${km} km`;
  }
  if (poi.distanceMeters > 0) {
    return model.locale === 'en' ? `${poi.distanceMeters} m` : `${poi.distanceMeters} m`;
  }
  return null;
}

function renderPoiParagraph(model: HotelKitModel, poi: LocalisedPointOfInterest): string {
  const chunks: string[] = [];
  if (poi.description !== null && poi.description.trim() !== '') {
    chunks.push(poi.description.trim());
  }
  if (poi.hours !== null && poi.hours.trim() !== '') chunks.push(poi.hours.trim());
  if (poi.phone !== null && poi.phone.trim() !== '') {
    chunks.push(model.locale === 'en' ? `Tel. ${poi.phone.trim()}` : `Tél. ${poi.phone.trim()}`);
  }
  const distance = formatPoiDistanceLabel(model, poi);
  if (distance !== null) chunks.push(distance);
  if (chunks.length === 0 && poi.tip !== null) chunks.push(poi.tip.trim());
  return escapeHtml(chunks.join('. '));
}

function renderPoiConciergeWhy(poi: LocalisedPointOfInterest, prominent = false): string {
  if (poi.tip === null || poi.tip.trim() === '') return '';
  if (poi.description !== null && poi.description.trim() === poi.tip.trim()) return '';
  return `<p class="cc-why${prominent ? '' : ' cc-why-sm'}">${escapeHtml(poi.tip.trim())}</p>`;
}

function isAroundConciergeFrame(bucket: 'visit' | 'do' | 'eat' | 'shop', isPick: boolean): boolean {
  return isPick && (bucket === 'do' || bucket === 'eat');
}

function renderRestoKindLine(venue: LocalisedRestaurantVenue): string {
  const parts: string[] = [];
  if (venue.type !== null && venue.type.trim() !== '') parts.push(venue.type.trim());
  if (venue.chef !== null && venue.chef.trim() !== '') parts.push(venue.chef.trim());
  if (venue.michelinStars !== null && venue.michelinStars > 0) {
    parts.push(
      venue.michelinStars === 1 ? '1 étoile MICHELIN' : `${venue.michelinStars} étoiles MICHELIN`,
    );
  }
  return parts.join(' · ');
}

function renderRestoMainPara(model: HotelKitModel, venue: LocalisedRestaurantVenue): string {
  if (venue.description !== null && venue.description.trim() !== '') {
    return `<p>${escapeHtml(venue.description.trim())}</p>`;
  }
  const chunks: string[] = [];
  if (venue.features.length > 0) chunks.push(venue.features.join(', '));
  if (venue.hours !== null && venue.hours.trim() !== '') chunks.push(venue.hours.trim());
  if (venue.phone !== null && venue.phone.trim() !== '') {
    chunks.push(
      model.locale === 'en' ? `Tel. ${venue.phone.trim()}` : `Tél. ${venue.phone.trim()}`,
    );
  }
  if (venue.mustOrder !== null && venue.mustOrder.trim() !== '') {
    chunks.push(venue.mustOrder.trim());
  }
  if (chunks.length === 0) return '';
  return `<p>${escapeHtml(chunks.join('. '))}</p>`;
}

function renderRestoConciergeWhy(venue: LocalisedRestaurantVenue): string {
  if (venue.tip === null || venue.tip.trim() === '') return '';
  return `<p class="cc-why">${escapeHtml(venue.tip.trim())}</p>`;
}

function formatExperiencePrice(
  model: HotelKitModel,
  exp: HotelKitModel['signatureExperiences'][number],
): string {
  if (exp.priceNote !== null && exp.priceNote.trim() !== '') {
    const note = exp.priceNote.trim();
    if (
      note.includes('€') &&
      !note.toLowerCase().includes('personne') &&
      !note.toLowerCase().includes('person')
    ) {
      return model.locale === 'en'
        ? `${note} <small>/ person</small>`
        : `${note}&nbsp;<small>/ personne</small>`;
    }
    return note;
  }
  return model.locale === 'en' ? 'On request' : 'Sur demande';
}

const KIT_JUSTIFIED_IMG_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_700,h_525';

function renderKitJustifiedSlide(options: {
  readonly title: string;
  readonly description: string;
  readonly imgSrc: string;
  readonly imgAlt: string;
  readonly priceHtml: string;
  readonly linkHref: string;
  readonly linkLabel: string;
  readonly linkExternal: boolean;
  readonly isConciergePick?: boolean;
  readonly pickLabel?: string;
  readonly tipHtml?: string;
  readonly slideRatio?: number;
}): string {
  const ratio = options.slideRatio ?? 1.1;
  const pick =
    options.isConciergePick === true && options.pickLabel !== undefined
      ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(options.pickLabel)}</span>`
      : '';
  const tip = options.tipHtml ?? '';
  const cardClass = options.isConciergePick === true ? ' exp-concierge' : '';
  const externalAttr = options.linkExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<article class="exp-justified-slide${cardClass}" style="--exp-slide-ratio: ${ratio}">
            <div class="exp-justified-media">
              <img src="${escapeHtml(options.imgSrc)}" alt="${escapeHtml(options.imgAlt)}" loading="lazy">
              ${pick}
              <div class="exp-justified-overlay">
                <h4>${escapeHtml(options.title)}</h4>
                <p class="exp-justified-desc">${escapeHtml(options.description)}</p>
                ${tip}
                <div class="exp-foot">
                  <span class="exp-price">${options.priceHtml}</span>
                  <a href="${escapeHtml(options.linkHref)}" class="link-or"${externalAttr}>${escapeHtml(options.linkLabel)}</a>
                </div>
              </div>
            </div>
          </article>`;
}

function renderKitJustifiedCarouselSection(
  model: HotelKitModel,
  options: {
    readonly title: string;
    readonly lede?: string;
    readonly slides: readonly string[];
    readonly carouselId: string;
  },
): string {
  if (options.slides.length === 0) return '';
  const ledePart =
    options.lede !== undefined && options.lede.length > 0
      ? `<p class="sub-lede">${escapeHtml(options.lede)}</p>`
      : '';
  return `<div class="bref-sub">
        <h3>${escapeHtml(options.title)}</h3>
        ${ledePart}
        <div class="carousel exp-justified-carousel" data-kit-carousel id="${escapeHtml(options.carouselId)}">
          <div class="carousel-track">
            ${options.slides.join('\n            ')}
          </div>
          ${options.slides.length > 1 ? renderKitCarouselNav(model.locale) : ''}
        </div>
      </div>`;
}

function buildSpaOverlayDescription(
  model: HotelKitModel,
  spa: NonNullable<HotelKitModel['spa']>,
): string {
  const chunks: string[] = [];
  if (spa.description !== null && spa.description.trim() !== '') {
    chunks.push(spa.description.trim());
  }
  const meta: string[] = [];
  if (spa.hours !== null && spa.hours.trim() !== '') {
    meta.push(
      model.locale === 'en'
        ? `Open daily · ${spa.hours.trim()}`
        : `Ouvert tous les jours · ${spa.hours.trim()}`,
    );
  }
  if (spa.features.length > 0) {
    meta.push(spa.features.join(', '));
  } else if (spa.treatmentRooms !== null || spa.surfaceSqm !== null) {
    const parts: string[] = [];
    if (spa.treatmentRooms !== null) {
      parts.push(
        model.locale === 'en'
          ? `${spa.treatmentRooms} treatment rooms`
          : `${spa.treatmentRooms} salles de soins`,
      );
    }
    if (spa.surfaceSqm !== null) {
      parts.push(
        model.locale === 'en'
          ? `${spa.surfaceSqm} m² fitness area`
          : `fitness ${spa.surfaceSqm} m²`,
      );
    }
    if (parts.length > 0) meta.push(parts.join(', '));
  }
  if (spa.phone !== null && spa.phone.trim() !== '') {
    meta.push(spa.phone.trim());
  }
  if (meta.length > 0) chunks.push(meta.join(' · '));
  return chunks.join(' — ');
}

function formatSpaPriceHtml(model: HotelKitModel, spa: NonNullable<HotelKitModel['spa']>): string {
  if (spa.priceNote !== null && spa.priceNote.trim() !== '') {
    const note = escapeHtml(spa.priceNote.trim());
    const suffix =
      model.locale === 'en'
        ? ' on request with the concierge'
        : ' sur réservation auprès de la conciergerie';
    return `${note}<small>${escapeHtml(suffix)}</small>`;
  }
  return model.locale === 'en' ? 'On request' : 'Sur demande';
}

function renderSpaFeatureBlock(model: HotelKitModel): string {
  const spa = model.spa;
  if (spa === null) return '';

  const img = model.media.spaHero(spa.name);
  const moreHrefRaw = spa.website ?? spa.reservationUrl ?? model.reservationBasePath;
  const moreHref = moreHrefRaw.startsWith('http')
    ? (localizeKitOfficialHref(moreHrefRaw, model.locale) ?? moreHrefRaw)
    : moreHrefRaw;
  const moreExternal = moreHref.startsWith('http');
  const moreLabel = model.locale === 'en' ? 'Learn more →' : 'En savoir plus →';
  const tipHtml =
    spa.tip !== null && spa.tip.trim() !== ''
      ? `<p class="cc-why">${escapeHtml(spa.tip.trim())}</p>`
      : undefined;

  const slide = renderKitJustifiedSlide({
    title: spa.name,
    description: buildSpaOverlayDescription(model, spa),
    imgSrc: img.src,
    imgAlt: img.alt,
    priceHtml: formatSpaPriceHtml(model, spa),
    linkHref: moreHref,
    linkLabel: moreLabel,
    linkExternal: moreExternal,
    ...(tipHtml !== undefined ? { tipHtml } : {}),
    slideRatio: 1.18,
  });

  return renderKitJustifiedCarouselSection(model, {
    title: model.locale === 'en' ? 'Spa & wellness' : 'Spa & bien-être',
    slides: [slide],
    carouselId: 'spa-justified-carousel',
  });
}

function renderKidClubBlock(model: HotelKitModel): string {
  const kidClubs = model.signatureExperiences.filter((e) => e.kind === 'kid_club');
  if (kidClubs.length === 0) return '';

  const slides = kidClubs.map((k, index) => {
    const img =
      k.imagePublicId !== null
        ? {
            src: buildCloudinarySrc({
              cloudName: model.cloudName,
              publicId: k.imagePublicId,
              transforms: KIT_JUSTIFIED_IMG_TRANSFORMS,
            }),
            alt: k.title,
          }
        : model.media.kidClub(k.title);
    const link = resolveKitLearnMoreLink(model, k);
    const ageLine = model.locale === 'en' ? 'From 4 years' : 'À partir de 4 ans';
    const activitiesLine =
      model.locale === 'en'
        ? 'Creative workshops, treasure hunts, secure pool'
        : 'Ateliers créatifs, chasses au trésor, piscine sécurisée';
    const description = `${k.description} — ${ageLine}. ${activitiesLine}.`;
    const priceHtml =
      model.locale === 'en'
        ? 'Included for resident children'
        : 'Accès inclus pour les enfants des résidents';

    return renderKitJustifiedSlide({
      title: k.title,
      description,
      imgSrc: img.src,
      imgAlt: img.alt,
      priceHtml,
      linkHref: link.href,
      linkLabel: link.label,
      linkExternal: link.external,
      slideRatio: signatureExperienceSlideRatio(index, false),
    });
  });

  return renderKitJustifiedCarouselSection(model, {
    title: model.locale === 'en' ? 'Kids Club' : 'Kids Club',
    slides,
    carouselId: 'kid-club-justified-carousel',
  });
}

function renderRestoFoot(model: HotelKitModel, venue: LocalisedRestaurantVenue): string {
  const price =
    venue.priceNote !== null && venue.priceNote.trim() !== ''
      ? venue.priceNote.trim()
      : model.locale === 'en'
        ? 'À la carte'
        : 'À la carte';
  const localizedWebsite = localizeKitOfficialHref(venue.website, model.locale);
  const localizedReservation = localizeKitOfficialHref(venue.reservationUrl, model.locale);
  const bookHref = localizedReservation ?? localizedWebsite ?? model.reservationBasePath;
  const external = bookHref.startsWith('http');
  const bookLabel = model.locale === 'en' ? 'Book →' : 'Réserver →';
  return `<div class="resto-foot">
                <span class="resto-price">${escapeHtml(price)}</span>
                <a href="${escapeHtml(bookHref)}" class="link-or"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${bookLabel}</a>
              </div>`;
}

export function renderKitBreadcrumb(model: HotelKitModel): string {
  const p = localePrefix(model.locale);
  const countryHubPath = buildHotelCountryHubPath(model.row, model.locale);
  return `<nav class="breadcrumb wrap" aria-label="Fil d'Ariane">
  <a href="${p}/hotels">${model.locale === 'en' ? 'Hotels' : 'Hôtels'}</a><span>›</span>
  <a href="${p}${countryHubPath}">${escapeHtml(model.countryLabel)}</a><span>›</span>
  <a href="${p}/destination/${escapeHtml(model.cityHubSlug)}">${escapeHtml(model.city)}</a><span>›</span>
  <span class="bc-current">${escapeHtml(model.name)}</span>
</nav>`;
}

export function renderKitHead(model: HotelKitModel): string {
  const category = model.isPalace ? 'Palace' : `${model.stars}★`;
  const eyebrow = [category, model.city, model.region].filter(Boolean).join(' · ');
  const addressParts: string[] = [];
  if (model.address !== null && model.address.trim() !== '')
    addressParts.push(model.address.trim());
  const locality =
    model.postalCode !== null && model.postalCode !== ''
      ? `${model.postalCode} ${model.city}`.trim()
      : model.city;
  if (locality.length > 0) addressParts.push(locality);
  if (model.district !== '' && !locality.includes(model.district)) {
    addressParts.push(model.district);
  }
  const addressLine = addressParts.join(', ');
  const palaceBadge = model.isPalace
    ? `<span class="htl-palace">${model.locale === 'en' ? 'Palace distinction' : 'Distinction Palace'}</span>`
    : '';
  const ratingBlock =
    model.resolvedRating !== null
      ? `<div class="htl-rating">
        <span class="rt-score">${formatRatingFr(model.resolvedRating.ratingValue)}</span>
        <span class="rt-tx"><b>${escapeHtml(ratingQualitativeLabel(model.resolvedRating.ratingValue, model.locale))}</b><span>${escapeHtml(model.labels.ratingSuffix)}</span></span>
      </div>`
      : '';

  return `<header class="htl-head">
      <span class="eyebrow left">${escapeHtml(eyebrow)}</span>
      <h1>${escapeHtml(model.name)}</h1>
      <div class="htl-stars" aria-label="${escapeHtml(category)}">
        ${'★'.repeat(model.stars)} ${palaceBadge}
      </div>
      ${
        addressLine.length > 0 ? `<p class="htl-loc">${ICON_LOC}${escapeHtml(addressLine)}</p>` : ''
      }
      ${ratingBlock}
    </header>`;
}

export function renderKitFeats(model: HotelKitModel): string {
  if (model.highlights.length === 0) return '';
  const items = model.highlights
    .slice(0, 4)
    .map((h) => `<li>${ICON_CHECK}${escapeHtml(h)}</li>`)
    .join('\n      ');
  return `<ul class="htl-feats">
      ${items}
    </ul>`;
}

export function renderKitSectionNav(model: HotelKitModel): string {
  if (model.navItems.length === 0) return '';
  const links = model.navItems
    .map((item) => {
      const mobileHidden = item.mobileHidden === true ? ' htl-nav__link--desktop-only' : '';
      return `<a href="#${escapeHtml(item.anchor)}" class="htl-nav__link${mobileHidden}">
        <span class="htl-nav__text-full">${escapeHtml(item.label)}</span>
        <span class="htl-nav__text-short" aria-hidden="true">${escapeHtml(item.shortLabel)}</span>
      </a>`;
    })
    .join('\n        ');
  return `<nav class="htl-nav" aria-label="${escapeHtml(model.labels.navHeading)}">
      <div class="htl-nav__track">
        ${links}
      </div>
    </nav>`;
}

export function renderKitFactualSummary(model: HotelKitModel): string {
  const text =
    model.factualSummary?.text ??
    (model.description !== null ? model.description.slice(0, 280) : null);
  if (text === null || text.length === 0) return '';
  return `<p id="factual-summary" data-aeo="factual-summary" data-llm-summary class="htl-factual">${escapeHtml(text)}</p>`;
}

export function renderKitApropos(model: HotelKitModel): string {
  const hook =
    model.conciergeHook !== null
      ? `<div class="concierge-quote">
        <span class="cq-mark">“</span>
        <p class="cq-text">${escapeHtml(model.conciergeHook)}</p>
        <div class="cq-sign"><span class="cq-name">${model.locale === 'en' ? 'The Concierge' : 'Le Concierge'}</span></div>
      </div>`
      : '';
  const prose = model.descriptionParagraphs
    .map((p) => `<p class="htl-prose">${escapeProseHtml(p)}</p>`)
    .join('\n          ');
  const historyAnchors = new Set(['histoire-art', 'histoire', 'histoire-heritage']);
  const longStorySectionsHtml = model.storySections
    .filter((section) => !historyAnchors.has(section.anchor))
    .map((section) => {
      const paras = section.paragraphs
        .map((p) => `<p class="htl-prose">${escapeProseHtml(p)}</p>`)
        .join('\n          ');
      return `<div class="story-section" id="${escapeHtml(section.anchor)}">
        <h3>${escapeHtml(section.title)}</h3>
        ${paras}
      </div>`;
    })
    .join('\n      ');
  const toggleMore =
    model.locale === 'en' ? 'Read the full description' : 'Lire la description complète';
  const toggleLess = model.locale === 'en' ? 'Show less' : 'Réduire';
  const h2 =
    model.locale === 'en'
      ? `${model.name} through the Concierge's eyes`
      : `${model.name} vu par le Concierge`;
  const eyebrow = model.locale === 'en' ? 'A word from the Concierge' : 'Le mot du Concierge';

  return `<section class="htl-section" id="apropos">
      <span class="eyebrow left">${eyebrow}</span>
      <h2>${escapeHtml(h2)}</h2>
      ${hook}
      <div class="read-more" id="seo-prose">
        <div class="rm-clip">
          ${prose}
          ${longStorySectionsHtml}
        </div>
        <button type="button" class="rm-toggle" aria-expanded="false" data-more="${toggleMore}" data-less="${toggleLess}">
          <span>${toggleMore}</span>
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
    </section>`;
}

function extractRoomPriceAmount(
  livePriceText: string | null,
  priceLabel: string | null,
): string | null {
  const raw = livePriceText ?? priceLabel;
  if (raw === null || raw.trim() === '') return null;
  const amount = raw
    .replace(/^À partir de\s+/iu, '')
    .replace(/^From\s+/iu, '')
    .replace(/^dès\s+/iu, '')
    .replace(/\s*\/\s*n(?:u(?:it|ight))?\s*$/iu, '')
    .trim();
  return amount.length > 0 ? amount : null;
}

function renderRoomPriceHtml(model: HotelKitModel, room: HotelRoomCardVM): string {
  const amount = extractRoomPriceAmount(room.livePriceText, room.priceLabel);
  if (amount === null) return '';
  return `<span class="rv2-price">${escapeHtml(amount)}<small>${escapeHtml(model.labels.fromPriceUnit)}</small></span>`;
}

function renderRoomImageHtml(
  images: readonly { readonly src: string; readonly alt: string }[],
): string {
  const [img] = images;
  if (img === undefined) return '';
  return `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy">`;
}

function renderRoomCard(model: HotelKitModel, room: HotelRoomCardVM): string {
  const galleryHtml = renderRoomImageHtml(room.images);
  const pickBadge = room.isConciergePick
    ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(model.labels.conciergePick)}</span>`
    : '';
  const pickClass = room.isConciergePick ? ' room-concierge' : '';
  const factsSource =
    room.factLines !== undefined && room.factLines.length > 0 ? room.factLines : null;
  const factsHtml =
    factsSource !== null
      ? factsSource
          .map((f) => {
            const icon = f.kind === 'bed' ? ICON_BED : ICON_AREA;
            return `<li>${icon}${escapeHtml(f.text)}</li>`;
          })
          .join('\n                ')
      : room.facts.map((f) => `<li>${ICON_AREA}${escapeHtml(f)}</li>`).join('\n                ');
  const hasFacts = factsSource !== null ? factsSource.length > 0 : room.facts.length > 0;
  const priceHtml = renderRoomPriceHtml(model, room);
  const why =
    room.conciergeNote !== null ? `<p class="cc-why">${escapeHtml(room.conciergeNote)}</p>` : '';

  return `<article class="room-v2${pickClass}" data-room-id="${escapeHtml(room.id)}">
            <div class="rv2-img">
              ${galleryHtml}
              ${pickBadge}
            </div>
            <div class="rv2-body">
              <h3>${escapeHtml(room.name)}</h3>
              ${room.description !== null ? `<p class="rv2-desc">${escapeHtml(room.description)}</p>` : ''}
              ${why}
              ${hasFacts ? `<ul class="rv2-facts">${factsHtml}</ul>` : ''}
              <div class="rv2-cta">
                ${priceHtml}
                <a href="${escapeHtml(room.roomPageHref ?? model.reservationBasePath)}" class="btn btn-or">${escapeHtml(model.labels.selectRoom)}</a>
              </div>
            </div>
          </article>`;
}

export function renderKitChambres(model: HotelKitModel): string {
  if (model.roomCards.length === 0) return '';
  const cards = model.roomCards.map((r) => renderRoomCard(model, r)).join('\n\n          ');
  const lede =
    model.locale === 'en'
      ? `${model.roomCount} rooms and suites — our Concierge's priority selection.`
      : `${model.roomCount} chambres et suites — voici la sélection que nous recommandons en priorité.`;
  return `<section class="htl-section" id="chambres">
      <h2>${escapeHtml(model.labels.roomsSectionTitle)}</h2>
      <p class="htl-lede">${escapeHtml(lede)}</p>
      <div class="carousel rooms-carousel" data-kit-carousel id="chambres-carousel">
        <div class="carousel-track">
          ${cards}
        </div>
        ${model.roomCards.length > 1 ? renderKitCarouselNav(model.locale) : ''}
      </div>
      <div class="rooms-more">
        <a href="${escapeHtml(model.travelportRoomsHref)}" class="btn-ligne">${escapeHtml(model.labels.roomsMore)} →</a>
      </div>
    </section>`;
}

function signatureExperienceSlideRatio(expIndex: number, isPick: boolean): number {
  if (isPick) return 1.42;
  const ratios = [1.18, 0.9, 1.32, 0.86, 1.08, 1.24, 0.94, 1.15];
  return ratios[expIndex % ratios.length] ?? 1.1;
}

export function renderKitBref(model: HotelKitModel): string {
  const curatedAmenHtml = resolveKitAmenityBlocks(model.slugFr)
    .map((block) => {
      const title = model.locale === 'en' ? block.titleEn : block.titleFr;
      const detail = model.locale === 'en' ? block.descEn : block.descFr;
      return `<div class="amen">${amenityIconHtml(block.icon)}<b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span></div>`;
    })
    .join('\n          ');

  const amenHtml =
    curatedAmenHtml.length > 0
      ? curatedAmenHtml
      : model.amenitiesFlat
          .slice(0, 12)
          .map(
            (label) =>
              `<div class="amen">${amenityIconHtml('daily')}<b>${escapeHtml(label)}</b></div>`,
          )
          .join('\n          ');

  const historyBlock =
    model.storySections.length > 0
      ? (() => {
          const section =
            model.storySections.find(
              (s) =>
                s.anchor === 'histoire-art' ||
                s.anchor === 'histoire' ||
                s.anchor === 'histoire-heritage',
            ) ?? model.storySections[0];
          if (section === undefined) return '';
          const [ledePara, ...restParas] = section.paragraphs;
          const paras = restParas
            .map((p) => `<p class="histoire-txt">${escapeProseHtml(p)}</p>`)
            .join('\n        ');
          return `<div class="bref-sub bref-histoire">
        ${wrapKitDisclosure({
          title: section.title,
          ...(ledePara !== undefined ? { lede: ledePara } : {}),
          body: paras,
        })}
      </div>`;
        })()
      : '';

  const amenitiesLede =
    model.locale === 'en'
      ? `${model.amenitiesFlat.length} services and amenities — palace essentials without excess.`
      : `${model.amenitiesFlat.length} services et équipements, de la conciergerie 24h/24 au Wi-Fi gratuit. L'essentiel d'un palace, sans surenchère.`;
  const amenitiesTitle = model.locale === 'en' ? 'Services & amenities' : 'Services & équipements';
  const amenitiesBody = `<div class="amen-grid">
          ${amenHtml}
        </div>`;

  const expList = orderKitSignatureExperiences(
    model.signatureExperiences.filter((e) => e.kind !== 'kid_club'),
  );
  const expSlides = expList.map((exp, expIndex) => {
    const isPick = isKitSignatureExperienceConciergePick(exp);
    const imgTile =
      exp.imagePublicId !== null
        ? {
            src: buildCloudinarySrc({
              cloudName: model.cloudName,
              publicId: exp.imagePublicId,
              transforms: KIT_JUSTIFIED_IMG_TRANSFORMS,
            }),
            alt: exp.title,
          }
        : model.media.experienceAt(expIndex, exp.title);
    const tipHtml =
      isPick && exp.tip !== null && exp.tip.trim() !== ''
        ? `<p class="cc-why">${escapeHtml(exp.tip.trim())}</p>`
        : undefined;
    const link = resolveKitLearnMoreLink(model, exp);
    return renderKitJustifiedSlide({
      title: exp.title,
      description: exp.description,
      imgSrc: imgTile.src,
      imgAlt: imgTile.alt,
      priceHtml: formatExperiencePrice(model, exp),
      linkHref: link.href,
      linkLabel: link.label,
      linkExternal: link.external,
      isConciergePick: isPick,
      pickLabel: model.labels.conciergePick,
      ...(tipHtml !== undefined ? { tipHtml } : {}),
      slideRatio: signatureExperienceSlideRatio(expIndex, isPick),
    });
  });

  const expSection =
    expSlides.length > 0
      ? renderKitJustifiedCarouselSection(model, {
          title: model.locale === 'en' ? 'Signature experiences' : 'Expériences signature',
          lede:
            model.locale === 'en'
              ? 'What the concierge arranges for you, beyond the room.'
              : 'Ce que la conciergerie organise pour vous, au-delà de la chambre.',
          slides: expSlides,
          carouselId: 'exp-justified-carousel',
        })
      : '';

  const restos = model.restaurants?.venues ?? [];
  const restoHtml = restos
    .map((r, i) => {
      const img = model.media.diningForVenue(r.name, i, r.name);
      const isPick = i === 0;
      const pick = isPick
        ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(model.labels.conciergePick)}</span>`
        : '';
      const cardClass = isPick ? 'resto-card resto-concierge' : 'resto-card';
      const kindLine = renderRestoKindLine(r);
      const why = isPick ? renderRestoConciergeWhy(r) : '';
      return `<article class="${cardClass}">
            <div class="resto-img">
              <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy">
              ${pick}
            </div>
            <div class="resto-body">
              <h4>${escapeHtml(r.name)}</h4>
              ${kindLine.length > 0 ? `<span class="resto-kind">${escapeHtml(kindLine)}</span>` : ''}
              ${renderRestoMainPara(model, r)}
              ${why}
              ${renderRestoFoot(model, r)}
            </div>
          </article>`;
    })
    .join('\n\n          ');

  const spaBlock = renderSpaFeatureBlock(model);
  const kidHtml = renderKidClubBlock(model);

  return `<section class="htl-section" id="hotel-en-bref">
      <h2>${escapeHtml(model.labels.briefHotel)}</h2>
      ${historyBlock}
      <div class="bref-sub bref-amenities">
        ${wrapKitDisclosure({
          title: amenitiesTitle,
          lede: amenitiesLede,
          body: amenitiesBody,
          className: 'kit-disclosure--bref',
          titleId: 'amenities-title',
        })}
      </div>
      ${expSection}
      ${
        restos.length > 0
          ? `<div class="bref-sub">
        <h3>Restaurants &amp; bars</h3>
        <p class="sub-lede">${model.locale === 'en' ? 'Six addresses under one roof. Our favourite table wears the Concierge badge.' : 'Six adresses sous le même toit. Notre table préférée porte le badge du Concierge.'}</p>
        <div class="carousel resto-carousel" data-kit-carousel id="resto-carousel">
          <div class="carousel-track">
            ${restoHtml}
          </div>
          ${restos.length > 1 ? renderKitCarouselNav(model.locale) : ''}
        </div>
      </div>`
          : ''
      }
      ${spaBlock}
      ${kidHtml}
    </section>`;
}

function formatFullAddress(model: HotelKitModel): string {
  const parts: string[] = [];
  if (model.address !== null && model.address.trim() !== '') parts.push(model.address.trim());
  const locality =
    model.postalCode !== null && model.postalCode !== ''
      ? `${model.postalCode} ${model.city}`.trim()
      : model.city;
  if (locality.length > 0) parts.push(locality);
  if (model.region.trim().length > 0) parts.push(model.region);
  return parts.join(', ');
}

function formatPolicyLines(model: HotelKitModel): string[] {
  const lines: string[] = [];
  const { policies } = model;
  if (policies.checkIn !== null || policies.checkOut !== null) {
    const inPart =
      policies.checkIn !== null
        ? model.locale === 'en'
          ? `Check-in from ${policies.checkIn.from}`
          : `Arrivée à partir de ${policies.checkIn.from}`
        : '';
    const outPart =
      policies.checkOut !== null
        ? model.locale === 'en'
          ? `check-out before ${policies.checkOut.until}`
          : `départ avant ${policies.checkOut.until}`
        : '';
    const joined = [inPart, outPart].filter((s) => s.length > 0).join(' · ');
    if (joined.length > 0) lines.push(joined);
  }
  if (policies.pets !== null) {
    const base =
      policies.pets.allowed === true
        ? model.locale === 'en'
          ? 'Pets allowed'
          : 'Animaux acceptés'
        : model.locale === 'en'
          ? 'Pets not allowed'
          : 'Animaux non acceptés';
    const fee =
      policies.pets.feeEur !== null && policies.pets.feeEur > 0
        ? model.locale === 'en'
          ? ` (${policies.pets.feeEur} €/pet/day)`
          : ` (${policies.pets.feeEur} €/animal/jour)`
        : '';
    const notes =
      policies.pets.notes !== null && policies.pets.notes.trim() !== ''
        ? ` — ${policies.pets.notes.trim()}`
        : '';
    lines.push(`${base}${fee}${notes}`);
  }
  if (policies.wifi !== null && policies.wifi.included) {
    lines.push(model.locale === 'en' ? 'Complimentary Wi‑Fi' : 'Wi‑Fi gratuit');
  }
  if (policies.payment !== null && policies.payment.notes !== null) {
    lines.push(policies.payment.notes);
  }
  return lines;
}

function formatTransportLine(
  model: HotelKitModel,
  tr: HotelKitModel['transports'][number],
): string {
  const modeLabels: Record<string, { fr: string; en: string }> = {
    train: { fr: 'Gare', en: 'Station' },
    rail: { fr: 'Gare', en: 'Station' },
    metro: { fr: 'Métro', en: 'Metro' },
    airport: { fr: 'Aéroport', en: 'Airport' },
    airport_shuttle: { fr: 'Navette aéroport', en: 'Airport shuttle' },
    bus: { fr: 'Bus', en: 'Bus' },
  };
  const modeLabel = modeLabels[tr.mode]?.[model.locale] ?? tr.mode;
  const linePart = tr.line !== null && tr.line !== '' ? ` ${tr.line}` : '';
  const distKm = (tr.distanceMeters / 1000).toFixed(tr.distanceMeters >= 10_000 ? 0 : 1);
  const dist = model.locale === 'en' ? `${distKm} km` : `${distKm.replace('.', ',')} km`;
  const intercity = tr.mode === 'train' || tr.mode === 'airport' || tr.mode === 'airport_shuttle';
  const travel =
    intercity && tr.walkMinutes !== null && tr.distanceMeters >= 5000
      ? model.locale === 'en'
        ? ` · ${tr.walkMinutes} min drive`
        : ` · ${tr.walkMinutes} min en voiture`
      : tr.walkMinutes !== null
        ? model.locale === 'en'
          ? ` · ${tr.walkMinutes} min walk`
          : ` · ${tr.walkMinutes} min à pied`
        : '';
  const notes = tr.notes !== null && tr.notes.trim() !== '' ? ` — ${tr.notes.trim()}` : '';
  return `${modeLabel}${linePart} ${tr.station} (${dist})${travel}${notes}`;
}

function poiKitHoverId(poi: {
  readonly osmId: string | null;
  readonly name: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}): string {
  return poi.osmId ?? `${poi.name}-${poi.latitude ?? 0}-${poi.longitude ?? 0}`;
}

/** Empty mount point — {@link HotelKitMapPortal} hydrates the React map stack. */
function renderKitMapSlotHtml(model: HotelKitModel): string {
  if (model.latitude === null || model.longitude === null) return '';
  if (getMapboxAccessToken() === null) return '';
  return `<div id="hotel-kit-map-slot" class="hotel-kit-map-slot" aria-hidden="true"></div>`;
}

export function renderKitAcces(model: HotelKitModel): string {
  const fullAddress = formatFullAddress(model);
  const policyLines = formatPolicyLines(model);
  const transportLines = model.transports.slice(0, 4).map((tr) => formatTransportLine(model, tr));
  const visitLines = model.locationBuckets.visit.slice(0, 2).map((poi) => {
    const walk =
      poi.walkMinutes !== null
        ? model.locale === 'en'
          ? `${poi.walkMinutes} min walk`
          : `${poi.walkMinutes} min à pied`
        : null;
    const dist =
      poi.distanceMeters > 0
        ? model.locale === 'en'
          ? `${Math.round(poi.distanceMeters / 1000)} km`
          : `${(poi.distanceMeters / 1000).toFixed(1).replace('.', ',')} km`
        : null;
    const suffix = walk ?? dist ?? '';
    return suffix.length > 0 ? `${poi.name} — ${suffix}` : poi.name;
  });
  const accessLines = [...transportLines, ...visitLines];

  let addressItem = '';
  const coordsAfterAddress: string[] = [];
  if (fullAddress.length > 0) {
    addressItem = `<li>${ICON_LOC}${escapeHtml(fullAddress)}</li>`;
  }
  if (model.phone !== null) {
    coordsAfterAddress.push(`<li>${ICON_PHONE}${escapeHtml(model.phone)}</li>`);
  }
  if (model.emailReservations !== null) {
    coordsAfterAddress.push(
      `<li>${ICON_EMAIL}<a href="mailto:${escapeHtml(model.emailReservations)}">${escapeHtml(model.emailReservations)}</a></li>`,
    );
  }
  if (model.officialWebsiteUrl !== null) {
    const officialHref = localizeKitOfficialHref(model.officialWebsiteUrl, model.locale);
    if (officialHref !== null) {
      coordsAfterAddress.push(
        `<li>${ICON_LOC}<a href="${escapeHtml(officialHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.labels.officialWebsite)}</a></li>`,
      );
    }
  }
  if (model.googleMapsUrl !== null) {
    coordsAfterAddress.push(
      `<li>${ICON_LOC}<a href="${escapeHtml(model.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.labels.googleListing)}</a></li>`,
    );
  }

  const policyItems = policyLines
    .map((line) => `<li>${ICON_CHECK}${escapeHtml(line)}</li>`)
    .join('\n            ');
  const accessItems = accessLines
    .map((line) => `<li>${ICON_LOC}${escapeHtml(line)}</li>`)
    .join('\n            ');

  const mapBlock = renderKitMapSlotHtml(model);

  const reviewCards: string[] = [];
  const googleQuotes = model.googleReviews;
  if (googleQuotes.length > 0) {
    googleQuotes.forEach((review, index) => {
      reviewCards.push(renderGoogleReviewCardHtml(review, model.locale, index));
    });
  } else if (model.resolvedRating !== null) {
    const mapsLink =
      model.googleMapsUrl !== null
        ? `<p class="review-google-link"><a href="${escapeHtml(model.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">${model.locale === 'en' ? 'View all reviews on Google' : 'Voir tous les avis sur Google'}</a></p>`
        : '';
    reviewCards.push(
      `<blockquote class="review"><div class="rv-top"><span class="rv-score">${formatRatingFr(model.resolvedRating.ratingValue)}</span><span class="rv-name">${model.locale === 'en' ? 'Google rating' : 'Note Google'} · ${formatReviewCount(model.resolvedRating.reviewCount, model.locale)} ${model.locale === 'en' ? 'reviews' : 'avis'}</span></div><p>${model.locale === 'en' ? 'Individual Google reviews sync on the next Places refresh — aggregate rating shown below.' : 'Les avis Google nominatifs se synchronisent au prochain rafraîchissement Places — note agrégée ci-dessous.'}</p>${mapsLink}</blockquote>`,
    );
  }
  const reviewsHtml =
    reviewCards.length > 0
      ? `<div class="bref-sub">
        <h3>${escapeHtml(model.labels.travelerReviewsTitle)}</h3>
        <div class="carousel reviews-carousel" data-kit-carousel id="reviews-carousel">
          <div class="carousel-track">${reviewCards.join('\n          ')}</div>
          ${reviewCards.length > 1 ? renderKitCarouselNav(model.locale) : ''}
        </div>
      </div>`
      : '';

  const coordsContactLabel = model.locale === 'en' ? 'Contact & links' : 'Contact & liens';
  const coordsExtraHtml =
    coordsAfterAddress.length > 0
      ? wrapAccessDisclosure({
          title: coordsContactLabel,
          body: `<ul class="access-list">${coordsAfterAddress.join('\n            ')}</ul>`,
          className: 'access-disclosure--inline',
        })
      : '';

  const coordsCardHtml =
    addressItem.length > 0 || coordsExtraHtml.length > 0
      ? `<div class="access-card access-card--coords">
        <h4>${escapeHtml(model.labels.accessCoordsTitle)}</h4>
        ${addressItem.length > 0 ? `<ul class="access-list">${addressItem}</ul>` : ''}
        ${coordsExtraHtml}
      </div>`
      : '';

  const policiesCardHtml =
    policyItems.length > 0
      ? wrapAccessDisclosure({
          title: model.labels.accessPoliciesTitle,
          body: `<ul class="access-list">${policyItems}</ul>`,
          className: 'access-disclosure--card',
        })
      : '';

  const transportHtml =
    accessItems.length > 0
      ? wrapAccessDisclosure({
          title: model.labels.accessTransportTitle,
          body: `<ul class="access-list">${accessItems}</ul>`,
        })
      : '';

  if (
    coordsCardHtml.length === 0 &&
    policiesCardHtml.length === 0 &&
    transportHtml.length === 0 &&
    mapBlock.length === 0 &&
    reviewsHtml.length === 0
  ) {
    return '';
  }

  return `<section class="htl-section" id="acces">
      <h2>${escapeHtml(model.labels.access)}</h2>
      <div class="access-grid">
        ${coordsCardHtml}
        ${policiesCardHtml}
      </div>
      ${transportHtml.length > 0 ? `<div class="access-transport-wrap">${transportHtml}</div>` : ''}
      ${mapBlock}
      ${reviewsHtml}
    </section>`;
}

export function renderKitEnBref(model: HotelKitModel): string {
  const facts = model.enBref.facts
    .map(
      (f) =>
        `<div class="geo-row"><dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd></div>`,
    )
    .join('\n        ');
  const freshness =
    model.enBref.lastUpdatedLabel !== null
      ? `<p class="geo-fresh" data-freshness aria-label="${escapeHtml(model.enBref.lastUpdatedLabel)}"><span>${escapeHtml(model.enBref.updatedAtLabel)} ${escapeHtml(model.enBref.lastUpdatedLabel)}</span></p>`
      : '';

  return `<section class="htl-section geo-en-bref" id="en-bref" data-aeo data-llm-summary aria-label="${escapeHtml(model.enBref.eyebrow)}" style="border-bottom:none">
      <span class="eyebrow left">${escapeHtml(model.enBref.eyebrow)}</span>
      <h2>${escapeHtml(model.labels.enBrefSectionTitle)}</h2>
      <p class="geo-synthesis">${escapeHtml(model.enBref.synthesis)}</p>
      ${
        facts.length > 0
          ? `<details class="geo-details">
        <summary>${escapeHtml(model.enBref.detailsSummary)}</summary>
        <dl class="geo-facts">${facts}</dl>
      </details>`
          : ''
      }
      ${freshness}
    </section>`;
}

export function renderKitClub(model: HotelKitModel): string {
  const p = localePrefix(model.locale);
  const clubImg = resolveKitClubIllustration(model);
  return `<section class="htl-section club-inline" id="club">
      <div class="club-grid">
        <div class="club-illus" aria-hidden="true">
          <img src="${escapeHtml(clubImg.src)}" alt="${escapeHtml(clubImg.alt)}" loading="lazy" width="666" height="1000">
        </div>
        <div class="club-content">
          <span class="eyebrow left">Le Concierge Club</span>
          <h2>${model.locale === 'en' ? 'Your benefits from the first night' : 'Vos avantages dès la première nuit'}</h2>
          <ul class="club-list">
            <li>${ICON_CHECK}${model.locale === 'en' ? 'Upgrade when available' : 'Surclassement selon disponibilité'}</li>
            <li>${ICON_CHECK}${model.locale === 'en' ? 'Complimentary breakfast every morning' : 'Petit-déjeuner offert chaque matin'}</li>
            <li>${ICON_CHECK}${model.locale === 'en' ? 'Early check-in / late check-out (subject to availability)' : 'Arrivée anticipée / départ tardif (selon disponibilité)'}</li>
            <li>${ICON_CHECK}${model.locale === 'en' ? '€100 hotel credit to spend on site' : 'Crédit hôtel de 100 € à utiliser sur place'}</li>
          </ul>
          <a href="${p}/le-concierge-club" class="btn btn-or">${model.locale === 'en' ? 'Join the Club' : 'Rejoindre le Club'}</a>
        </div>
      </div>
    </section>`;
}

export function renderKitPresse(model: HotelKitModel): string {
  const pressHtml = model.featuredReviews
    .slice(0, 3)
    .map(
      (r) =>
        `<blockquote class="press-card"><span class="press-src">${escapeHtml(r.source)}</span><p>« ${escapeHtml(r.quote)} »</p></blockquote>`,
    )
    .join('\n          ');
  const awardHtml = model.awards
    .map(
      (a) =>
        `<span class="distinction">${ICON_STAR_AWARD}${escapeHtml(formatKitDistinctionLabel(a, model.locale))}</span>`,
    )
    .join('\n          ');
  const instaPosts = model.instagramFeed?.posts ?? [];
  const instaHtml = instaPosts
    .slice(0, 4)
    .map((post) => {
      const src =
        post.imagePublicId !== null
          ? buildCloudinarySrc({
              cloudName: model.cloudName,
              publicId: post.imagePublicId,
              transforms: 'f_auto,q_auto,c_fill,g_auto,w_400,h_400',
            })
          : model.galleryHero !== null
            ? model.galleryHero.src
            : KIT_GENERIC_ASSETS.proximity;
      return `<a href="${escapeHtml(model.instagramFeed?.profileUrl ?? '#')}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="${escapeHtml(post.caption ?? model.name)}" loading="lazy"></a>`;
    })
    .join('\n          ');
  const rankingHtml =
    model.featuredInRankings.length > 0
      ? (() => {
          const top = model.featuredInRankings[0];
          const rankingHref =
            top !== undefined
              ? getPathname({
                  locale: model.locale,
                  href: { pathname: '/classement/[slug]', params: { slug: top.slug } },
                })
              : getPathname({ locale: model.locale, href: '/classements' });
          return `<div class="ranking-callout">
          <p><b>${model.locale === 'en' ? 'Featured in our rankings.' : 'Cet hôtel apparaît dans nos classements.'}</b></p>
          <a href="${escapeHtml(rankingHref)}" class="btn-ligne">${model.locale === 'en' ? 'View ranking' : 'Voir le classement'}</a>
        </div>`;
        })()
      : '';

  if (pressHtml.length === 0 && awardHtml.length === 0 && instaHtml.length === 0) return '';

  return `<section class="htl-section" id="presse">
      <h2>${escapeHtml(model.labels.press)}</h2>
      ${
        pressHtml.length > 0
          ? `<div class="bref-sub"><h3>${model.locale === 'en' ? 'Press & professional rankings' : 'Extraits de presse & classements professionnels'}</h3><div class="press-grid">${pressHtml}</div></div>`
          : ''
      }
      ${
        awardHtml.length > 0
          ? `<div class="bref-sub"><h3>${model.locale === 'en' ? 'Awards' : 'Distinctions'}</h3><div class="distinctions">${awardHtml}</div></div>`
          : ''
      }
      ${
        instaHtml.length > 0
          ? `<div class="bref-sub"><h3>Instagram</h3><div class="insta-strip">${instaHtml}</div>${renderKitPressAffiliation(model)}${rankingHtml}</div>`
          : `${renderKitPressAffiliation(model).length > 0 ? `<div class="bref-sub">${renderKitPressAffiliation(model)}${rankingHtml}</div>` : rankingHtml}`
      }
    </section>`;
}

function renderAroundBucket(
  model: HotelKitModel,
  bucket: 'visit' | 'do' | 'eat' | 'shop',
  title: string,
  layout: 'carousel' | 'disclosure-grid',
): string {
  const pois = model.locationBuckets[bucket];
  if (pois.length === 0) return '';
  const items = pois
    .map((p, i) => {
      const hidden = layout === 'disclosure-grid' && i >= 3 ? ' more-hidden' : '';
      const isPick = p.tip !== null && i === 0;
      const useConciergeFrame = isAroundConciergeFrame(bucket, isPick);
      const pickLabel = useConciergeFrame
        ? model.labels.conciergePick
        : model.locale === 'en'
          ? 'Pick'
          : 'Choix';
      const pickOnImage =
        isPick && p.imagePublicId !== null
          ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(pickLabel)}</span>`
          : '';
      const pickInline =
        isPick && p.imagePublicId === null && useConciergeFrame
          ? `<span class="cc-pick inline">${ICON_STAR}${escapeHtml(pickLabel)}</span>`
          : '';
      const pickCorner =
        isPick && p.imagePublicId === null && !useConciergeFrame
          ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(pickLabel)}</span>`
          : '';
      const pickClass = useConciergeFrame ? ' around-concierge' : '';
      const category =
        p.category !== null && p.category.trim() !== ''
          ? `<span class="around-cat">${escapeHtml(p.category)}</span>`
          : '';
      const website =
        p.website !== null
          ? `<a href="${escapeHtml(p.website)}" class="link-or around-link" target="_blank" rel="noopener noreferrer">${model.locale === 'en' ? 'Website →' : 'Site →'}</a>`
          : '';
      const reserveTable =
        bucket === 'eat' && p.reservationUrl !== null
          ? `<a href="${escapeHtml(p.reservationUrl)}" class="around-reserve" target="_blank" rel="nofollow noopener noreferrer">${escapeHtml(model.labels.reserveTable)}</a>`
          : '';
      const poiId = escapeHtml(poiKitHoverId(p));
      const body = `${pickInline}${category}
            <h5>${escapeHtml(p.name)}</h5>
            <p>${renderPoiParagraph(model, p)}</p>
            ${i === 0 && isPick ? renderPoiConciergeWhy(p, useConciergeFrame) : ''}
            ${reserveTable}
            ${website}`;
      if (p.imagePublicId !== null) {
        const imgSrc = buildCloudinarySrc({
          cloudName: model.cloudName,
          publicId: p.imagePublicId,
          transforms: 'f_auto,q_auto,c_fill,g_auto,w_520,h_400',
        });
        return `<div class="around-item has-img${pickClass}${hidden}" data-poi-id="${poiId}">
            <div class="around-img">
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy">
              ${pickOnImage}
            </div>
            <div class="around-body">
              ${body}
            </div>
          </div>`;
      }
      return `<div class="around-item${pickClass}${hidden}" data-poi-id="${poiId}">
            ${pickCorner}
            ${body}
          </div>`;
    })
    .join('\n          ');

  if (layout === 'carousel') {
    const nav = pois.length > 1 ? renderKitCarouselNav(model.locale) : '';
    return `<div class="around-sub around-sub--carousel">
        <h3>${escapeHtml(title)}</h3>
        <div class="carousel around-carousel" data-kit-carousel>
          <div class="carousel-track">
            ${items}
          </div>
          ${nav}
        </div>
      </div>`;
  }

  const listBody = `<div class="around-list${pois.length > 3 ? ' is-collapsed' : ''}" data-around-list>
          ${items}
        </div>
        ${
          pois.length > 3
            ? `<div class="around-more-wrap"><button type="button" class="btn-ligne around-toggle-btn">${model.locale === 'en' ? 'See more' : 'Voir plus'}</button></div>`
            : ''
        }`;

  return `<div class="around-sub">
        ${wrapKitDisclosure({
          title,
          body: listBody,
        })}
      </div>`;
}

function renderKitPressAffiliation(model: HotelKitModel): string {
  switch (model.slugFr) {
    case 'les-airelles-gordes':
      if (model.locale === 'en') {
        return `<p class="affil-line"><strong>Affiliation:</strong> part of the <a href="https://airelles.com/en/destination/gordes-hotel/la-bastide-5-star-provence-luberon" target="_blank" rel="noopener noreferrer">Airelles</a> collection · <a href="https://guide.michelin.com/fr/fr/hotels-stays/gordes/airelles-gordes-la-bastide-6874" target="_blank" rel="noopener noreferrer">MICHELIN Guide</a> · <a href="https://www.forbestravelguide.com/hotels/french-riviera-france/airelles-gordes-la-bastide" target="_blank" rel="noopener noreferrer">Forbes Travel Guide</a>.</p>`;
      }
      return `<p class="affil-line"><strong>Affiliation :</strong> maison de la collection <a href="https://airelles.com/fr/destination/gordes-hotel/la-bastide-5-star-provence-luberon" target="_blank" rel="noopener noreferrer">Airelles</a> · profil <a href="https://guide.michelin.com/fr/fr/hotels-stays/gordes/airelles-gordes-la-bastide-6874" target="_blank" rel="noopener noreferrer">Guide MICHELIN</a> · <a href="https://www.forbestravelguide.com/hotels/french-riviera-france/airelles-gordes-la-bastide" target="_blank" rel="noopener noreferrer">Forbes Travel Guide</a>.</p>`;
    case 'prince-de-galles-paris':
      if (model.locale === 'en') {
        return `<p class="affil-line"><strong>Affiliation:</strong> member of <a href="https://www.marriott.com/en/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/overview/" target="_blank" rel="noopener noreferrer">The Luxury Collection</a> by Marriott · <a href="https://guide.michelin.com/fr/fr/hotels-stays/paris/prince-de-galles-6873" target="_blank" rel="noopener noreferrer">MICHELIN Guide</a>.</p>`;
      }
      return `<p class="affil-line"><strong>Affiliation :</strong> membre de <a href="https://www.marriott.com/fr/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/overview/" target="_blank" rel="noopener noreferrer">The Luxury Collection</a> by Marriott · profil <a href="https://guide.michelin.com/fr/fr/hotels-stays/paris/prince-de-galles-6873" target="_blank" rel="noopener noreferrer">Guide MICHELIN</a>.</p>`;
    default:
      return '';
  }
}

const EVENT_LIST_THUMB_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_220,h_220';

const EVENT_META_ICON_LOC =
  '<svg class="event-list-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const EVENT_META_ICON_DATE =
  '<svg class="event-list-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/></svg>';
const EVENT_META_ICON_TIME =
  '<svg class="event-list-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/></svg>';
const EVENT_META_ICON_PRICE =
  '<svg class="event-list-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16M7 15h1.5M15 15h2M6.5 6h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>';
const EVENT_CTA_TICKET_ICON =
  '<svg class="event-list-cta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.8a2 2 0 0 0 0 3.9V16.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.8a2 2 0 0 0 0-3.9z"/><path d="M9 8.5v7"/></svg>';

type EventDateRailParts =
  | { readonly kind: 'year-round'; readonly category: EventCategory }
  | { readonly kind: 'dated'; readonly day: string; readonly month: string };

function isYearRoundEventDateRange(startIso: string, endIso: string | null): boolean {
  if (endIso === null || endIso === startIso) return false;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === 0 &&
    start.getUTCDate() === 1 &&
    end.getUTCMonth() === 11 &&
    end.getUTCDate() === 31
  );
}

function getEventDateRailParts(
  ev: LocalisedUpcomingEvent,
  locale: 'fr' | 'en',
): EventDateRailParts {
  if (isYearRoundEventDateRange(ev.startDate, ev.endDate)) {
    return { kind: 'year-round', category: ev.category };
  }
  const start = new Date(`${ev.startDate}T00:00:00Z`);
  const day = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric' }).format(start);
  const month = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' })
    .format(start)
    .replace(/\.$/u, '')
    .toUpperCase();
  return { kind: 'dated', day, month };
}

function formatKitEventDateLabel(ev: LocalisedUpcomingEvent, locale: 'fr' | 'en'): string {
  if (ev.period !== null && ev.period.length > 0) return ev.period;
  const start = new Date(`${ev.startDate}T00:00:00Z`);
  const monthFull: 'long' | 'short' = locale === 'en' ? 'short' : 'long';
  const fmtFull = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: monthFull,
    year: 'numeric',
  });
  if (ev.endDate === null || ev.endDate === ev.startDate) {
    return fmtFull.format(start);
  }
  const end = new Date(`${ev.endDate}T00:00:00Z`);
  if (isYearRoundEventDateRange(ev.startDate, ev.endDate)) {
    return locale === 'en' ? 'Open year-round' : 'Ouvert toute l’année';
  }
  const fmtShort = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear === endYear) {
    return `${fmtShort.format(start)} – ${fmtFull.format(end)}`;
  }
  return `${fmtFull.format(start)} – ${fmtFull.format(end)}`;
}

function formatKitEventPricingLabel(
  model: HotelKitModel,
  ev: LocalisedUpcomingEvent,
): string | null {
  if (ev.pricing === null) return null;
  if (ev.pricing.type === 'free') return model.labels.eventsPricingFree;
  if (ev.pricing.amountEur !== null) {
    return model.locale === 'en'
      ? `From ${ev.pricing.amountEur} €`
      : `À partir de ${ev.pricing.amountEur} €`;
  }
  return model.labels.eventsPricingPaidNoAmount;
}

function kitEventCategoryLabel(model: HotelKitModel, category: EventCategory): string {
  switch (category) {
    case 'concert':
      return model.labels.eventsCategoryConcert;
    case 'expo':
      return model.labels.eventsCategoryExpo;
    case 'festival':
      return model.labels.eventsCategoryFestival;
    case 'sport':
      return model.labels.eventsCategorySport;
    case 'theater':
      return model.labels.eventsCategoryTheater;
    case 'other':
      return model.labels.eventsCategoryOther;
  }
}

function renderKitEventCategoryRailIcon(category: EventCategory): string {
  switch (category) {
    case 'concert':
      return '<path d="M9 17V4l10-2v13"/><circle cx="6" cy="17" r="3"/><circle cx="16" cy="15" r="3"/>';
    case 'expo':
      return '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 18 5-5 4 4 3-3 4 4"/>';
    case 'festival':
      return '<path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9z"/>';
    case 'sport':
      return '<path d="M8 21h8M12 17v4"/><path d="M6 4h12v4a6 6 0 0 1-12 0z"/>';
    case 'theater':
      return '<path d="M4 5c0 8 3.5 14 8 14s8-6 8-14c0 0-4 2-8 2S4 5 4 5z"/>';
    case 'other':
      return '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>';
    default:
      return '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>';
  }
}

function renderKitEventDateRail(parts: EventDateRailParts): string {
  if (parts.kind === 'year-round') {
    return `<div class="event-list-date event-list-date--year-round" aria-hidden="true">
        <svg class="event-list-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${renderKitEventCategoryRailIcon(parts.category)}</svg>
      </div>`;
  }
  return `<div class="event-list-date" aria-hidden="true">
        <span class="event-list-date__day">${escapeHtml(parts.day)}</span>
        <span class="event-list-date__month">${escapeHtml(parts.month)}</span>
      </div>`;
}

function resolveKitEventThumb(
  model: HotelKitModel,
  ev: LocalisedUpcomingEvent,
): { readonly src: string; readonly alt: string } {
  const alt = `${ev.name} — ${model.city}`;
  if (ev.imageUrl !== null && ev.imageUrl.length > 0) {
    if (ev.imageUrl.startsWith('http')) {
      return { src: ev.imageUrl, alt };
    }
    return {
      src: buildCloudinarySrc({
        cloudName: model.cloudName,
        publicId: ev.imageUrl,
        transforms: EVENT_LIST_THUMB_TRANSFORMS,
      }),
      alt,
    };
  }
  return { src: KIT_GENERIC_ASSETS.event, alt };
}

function isKitEventNew(ev: LocalisedUpcomingEvent, index: number): boolean {
  if (index > 0) return false;
  const today = new Date();
  const start = new Date(`${ev.startDate}T00:00:00Z`);
  const diffDays = (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 21;
}

function renderKitEventListCard(
  model: HotelKitModel,
  ev: LocalisedUpcomingEvent,
  index: number,
): string {
  const thumb = resolveKitEventThumb(model, ev);
  const dateLabel = formatKitEventDateLabel(ev, model.locale);
  const pricingLabel = formatKitEventPricingLabel(model, ev);
  const locationLabel =
    ev.venueName !== null && ev.venueName.length > 0 ? ev.venueName : model.city;
  const dateRail = renderKitEventDateRail(getEventDateRailParts(ev, model.locale));
  const categoryLabel = kitEventCategoryLabel(model, ev.category);
  const newRibbon = isKitEventNew(ev, index)
    ? `<span class="event-list-ribbon">${escapeHtml(model.labels.eventsNewBadge)}</span>`
    : '';

  const metaItems: string[] = [];
  if (locationLabel.length > 0) {
    metaItems.push(
      `<li class="event-list-meta-item">${EVENT_META_ICON_LOC}<span>${escapeHtml(locationLabel)}</span></li>`,
    );
  }
  if (dateLabel.length > 0) {
    metaItems.push(
      `<li class="event-list-meta-item">${EVENT_META_ICON_DATE}<span>${escapeHtml(dateLabel)}</span></li>`,
    );
  }
  if (ev.schedule !== null && ev.schedule.length > 0) {
    metaItems.push(
      `<li class="event-list-meta-item">${EVENT_META_ICON_TIME}<span>${escapeHtml(ev.schedule)}</span></li>`,
    );
  }
  if (pricingLabel !== null) {
    metaItems.push(
      `<li class="event-list-meta-item">${EVENT_META_ICON_PRICE}<span>${escapeHtml(pricingLabel)}</span></li>`,
    );
  }

  const description =
    ev.description !== null && ev.description.length > 0
      ? `<p class="event-list-desc">${escapeHtml(ev.description)}</p>`
      : '';

  const cta =
    ev.url !== null
      ? `<a href="${escapeHtml(ev.url)}" class="event-list-cta" target="_blank" rel="noopener noreferrer">${EVENT_CTA_TICKET_ICON}<span>${escapeHtml(model.labels.eventsBuyTicket)}</span></a>`
      : '';

  return `<article class="event-list-card" data-aeo="upcoming-event">
        ${newRibbon}
        <div class="event-list-thumb">
          <img src="${escapeHtml(thumb.src)}" alt="${escapeHtml(thumb.alt)}" width="220" height="220" loading="lazy" decoding="async" />
        </div>
        <div class="event-list-body">
          <span class="event-list-category">${escapeHtml(categoryLabel)}</span>
          <h3 class="event-list-title">${escapeHtml(ev.name)}</h3>
          <ul class="event-list-meta">${metaItems.join('')}</ul>
          ${description}
          ${cta}
        </div>
        ${dateRail}
      </article>`;
}

export function renderKitEventList(model: HotelKitModel): string {
  const events = model.upcomingEvents;
  if (events.length === 0) return '';
  const cards = events.map((ev, i) => renderKitEventListCard(model, ev, i)).join('\n      ');
  return `<section class="htl-section event-list-section" id="evenements" data-aeo="upcoming-events" aria-labelledby="event-list-title">
      <h2 id="event-list-title">${escapeHtml(model.labels.eventsTitle)}</h2>
      <p class="sub-lede">${escapeHtml(model.labels.eventsLead)}</p>
      <div class="event-list">${cards}</div>
    </section>`;
}

export function renderKitAutour(model: HotelKitModel): string {
  const bucketTitles = {
    visit: { fr: "Ce qu'on visite dans le quartier", en: 'What to visit nearby' },
    do: { fr: "Ce qu'on y fait", en: 'What to do' },
    eat: { fr: 'Restaurants & bars autour', en: 'Restaurants & bars nearby' },
    shop: { fr: 'Commerces à proximité', en: 'Shopping nearby' },
  } as const;

  const subs = [
    renderAroundBucket(model, 'visit', bucketTitles.visit[model.locale], 'carousel'),
    renderAroundBucket(model, 'do', bucketTitles.do[model.locale], 'carousel'),
    renderAroundBucket(model, 'eat', bucketTitles.eat[model.locale], 'disclosure-grid'),
    renderAroundBucket(model, 'shop', bucketTitles.shop[model.locale], 'disclosure-grid'),
  ]
    .filter((s) => s.length > 0)
    .join('\n');

  if (subs.length === 0) return '';
  return `<section class="htl-section" id="autour">
      <h2>${escapeHtml(model.labels.around)}</h2>
      ${subs}
    </section>`;
}

export function renderKitConciergeAdvice(model: HotelKitModel): string {
  if (model.conciergeAdvice === null) return '';
  return `<section class="htl-section concierge-advice-section" id="concierge-advice" data-aeo="concierge-advice">
      <h2>${escapeHtml(model.conciergeAdvice.title)}</h2>
      <p class="concierge-advice-body">${escapeHtml(model.conciergeAdvice.body)}</p>
    </section>`;
}

export function renderKitTopConciergeFaq(model: HotelKitModel): string {
  if (model.topConciergeFaq.length < 5) return '';
  const title =
    model.locale === 'en'
      ? 'The Concierge’s top 5 answers about this hotel'
      : 'Les 5 réponses du Concierge sur cet hôtel';
  const lead =
    model.locale === 'en'
      ? 'The questions my guests ask most often. Straight answers, no detours.'
      : 'Les questions que mes clients me posent le plus souvent. Réponses directes, sans détour.';
  const tipPrefix = model.locale === 'en' ? 'My tip' : 'Mon conseil';
  const items = model.topConciergeFaq
    .slice(0, 5)
    .map(
      (item, i) =>
        `<li class="faq-top-item" data-top-concierge-item="${i + 1}">
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>${
            item.conciergeTip !== null
              ? `<p class="faq-top-tip" data-concierge-tip="faq"><strong>${escapeHtml(tipPrefix)} :</strong> ${escapeHtml(item.conciergeTip)}</p>`
              : ''
          }
        </li>`,
    )
    .join('\n        ');
  return `<section class="htl-section faq-top-concierge" id="faq-top-concierge" data-aeo="top-concierge-faq" aria-labelledby="faq-top-concierge-title">
      <h2 id="faq-top-concierge-title">${escapeHtml(title)}</h2>
      <p class="faq-top-lede">${escapeHtml(lead)}</p>
      <ol class="faq-top-list" data-top-concierge-list>${items}</ol>
    </section>`;
}

const FAQ_VISIBLE_PER_GROUP = 3;

/** FAQ kit groups that stay expanded on first paint (FR + EN labels). */
function isKitFaqServicesGroupLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return (
    normalized === 'services' ||
    normalized === 'services inclus' ||
    normalized === 'included services'
  );
}

function renderFaqGroupBlock<T extends { question: string }>(
  locale: 'fr' | 'en',
  label: string,
  items: readonly T[],
  options: {
    groupIndex: number;
    concierge?: boolean;
    renderAnswer: (item: T) => string;
  },
): string {
  const seeMore = locale === 'en' ? 'See more' : 'Voir plus';
  const seeLess = locale === 'en' ? 'See less' : 'Voir moins';
  const hasMore = items.length > FAQ_VISIBLE_PER_GROUP;
  const collapsedClass = hasMore ? ' is-collapsed' : '';

  const details = items
    .map((item, itemIdx) => {
      const hidden = itemIdx >= FAQ_VISIBLE_PER_GROUP ? ' faq-more-hidden' : '';
      const conciergeClass = options.concierge ? ' faq-concierge' : '';
      return `<details class="faq-item${conciergeClass}${hidden}"><summary>${escapeHtml(item.question)}</summary>${options.renderAnswer(item)}</details>`;
    })
    .join('\n        ');

  const toggle = hasMore
    ? `<div class="faq-more-wrap"><button type="button" class="btn-ligne faq-toggle-btn" aria-expanded="false" data-more="${escapeHtml(seeMore)}" data-less="${escapeHtml(seeLess)}">${escapeHtml(seeMore)}</button></div>`
    : '';

  const defaultOpen = isKitFaqServicesGroupLabel(label);
  const openAttr = defaultOpen ? ' open' : '';
  const closedData = defaultOpen ? '' : ' data-default-closed="true"';

  return `<details class="faq-group faq-group-disclosure"${openAttr}${closedData}>
        <summary class="faq-group-disclosure__summary">
          <span class="faq-group-disclosure__title">${escapeHtml(label)}</span>
          <span class="faq-group-disclosure__chevron" aria-hidden="true"></span>
        </summary>
        <div class="faq-group-disclosure__body">
          <div class="faq-list${collapsedClass}" data-faq-list>${details}</div>
          ${toggle}
        </div>
      </details>`;
}

export function renderKitFaq(model: HotelKitModel): string {
  const groups = model.faqDisplayGroups
    .map((g, groupIdx) =>
      renderFaqGroupBlock(model.locale, g.label, g.items, {
        groupIndex: groupIdx,
        renderAnswer: (item) => `<p>${escapeHtml(item.answer)}</p>`,
      }),
    )
    .join('\n      ');
  if (groups.length === 0) return '';
  const faqBody = `<p class="htl-lede">${escapeHtml(model.labels.faqLede)}</p>
      ${groups}`;
  return `<section class="htl-section" id="faq">
      ${wrapKitDisclosure({
        title: model.labels.faq,
        body: faqBody,
        heading: 'h2',
        className: 'kit-disclosure--section',
        titleId: 'faq-title',
      })}
    </section>`;
}

export function renderKitConciergeQuestions(model: HotelKitModel): string {
  if (model.conciergeQuestionGroups.length === 0) return '';
  const groups = model.conciergeQuestionGroups
    .map((g, groupIdx) =>
      renderFaqGroupBlock(model.locale, g.label, g.items, {
        groupIndex: groupIdx,
        concierge: true,
        renderAnswer: (item) => `<p class="cq-reply">${escapeHtml(item.reply)}</p>`,
      }),
    )
    .join('\n      ');
  return `<section class="htl-section" id="concierge-questions">
      <h2>${escapeHtml(model.labels.conciergeQuestions)}</h2>
      <p class="htl-lede">${escapeHtml(model.labels.conciergeQuestionsLede)}</p>
      ${groups}
    </section>`;
}

export function renderKitProximite(model: HotelKitModel): string {
  const cards = pickProximityCards(model.relatedHotels, model.region);
  const p = localePrefix(model.locale);
  if (cards.length === 0) return '';
  const grid = cards
    .map((h) => {
      const slug = model.locale === 'en' && h.slug_en ? h.slug_en : h.slug;
      const img =
        h.hero_image !== null && h.hero_image !== ''
          ? buildCloudinarySrc({
              cloudName: model.cloudName,
              publicId: h.hero_image,
              transforms: 'f_auto,q_auto,c_fill,g_auto,w_600,h_450',
            })
          : KIT_GENERIC_ASSETS.proximity;
      const name = model.locale === 'en' && h.name_en ? h.name_en : h.name;
      return `<a href="${p}/hotel/${escapeHtml(slug)}" class="hcard">
          <div class="hcard-img"><img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy"></div>
          <div class="hcard-body"><h3>${escapeHtml(name)}</h3><span class="loc">${escapeHtml(h.city)}</span></div>
        </a>`;
    })
    .join('\n        ');
  const nav = cards.length > 1 ? renderKitCarouselNav(model.locale) : '';
  return `<section class="htl-section" id="proximite" style="border-bottom:none">
      <h2>${escapeHtml(model.labels.proximity)}</h2>
      <p class="htl-lede">${escapeHtml(model.labels.proximityLede)}</p>
      <div class="carousel nearby-carousel" data-kit-carousel>
        <div class="carousel-track">
          ${grid}
        </div>
        ${nav}
      </div>
      <div class="nearby-region">
        <a href="${p}/destination/${escapeHtml(model.cityHubSlug)}" class="btn-ligne">${escapeHtml(model.labels.exploreRegion)}</a>
      </div>
    </section>`;
}

/** Shell + main column (DA layout). Aside is rendered in React. */
export function assembleHotelKitShell(model: HotelKitModel): {
  readonly prefixHtml: string;
  /** Eyebrow + H1 + stars (+ loc/rating) — lifted out for mobile reorder vs gallery. */
  readonly headHtml: string;
  readonly mainHtml: string;
} {
  const main = [
    renderKitFeats(model),
    renderKitSectionNav(model),
    renderKitFactualSummary(model),
    renderKitApropos(model),
    renderKitChambres(model),
    renderKitBref(model),
    renderKitPresse(model),
    renderKitAcces(model),
    renderKitAutour(model),
    renderKitEventList(model),
    renderKitConciergeAdvice(model),
    ...(model.conciergeQuestionGroups.length === 0 ? [renderKitTopConciergeFaq(model)] : []),
    renderKitFaq(model),
    renderKitConciergeQuestions(model),
    renderKitProximite(model),
    renderKitEnBref(model),
    renderKitClub(model),
  ].join('\n\n    ');
  return {
    prefixHtml: renderKitBreadcrumb(model),
    headHtml: renderKitHead(model),
    mainHtml: main,
  };
}
