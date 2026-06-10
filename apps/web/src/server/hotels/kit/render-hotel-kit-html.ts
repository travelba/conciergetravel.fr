import 'server-only';

import { buildCloudinarySrc } from '@mch/ui';

import type { HotelRoomCardVM } from '@/components/hotel/hotel-rooms-grid';
import { pickProximityCards } from '@/server/hotels/get-related-hotels';

import { getPathname } from '@/i18n/navigation';
import { formatGoogleReviewDate } from '@/lib/format-google-review-date';
import { getMapboxAccessToken } from '@/lib/maps/mapbox-access';
import { buildMapboxExternalMapHref, buildMapboxStaticImageUrl } from '@/lib/maps/mapbox-static';

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
  LocalisedPointOfInterest,
  LocalisedRestaurantVenue,
} from '@/server/hotels/get-hotel-by-slug';

const REVIEW_CLAMP_CHARS = 220;

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

function renderSpaFeatureBlock(model: HotelKitModel): string {
  const spa = model.spa;
  if (spa === null) return '';

  const img = model.media.spaHero(spa.name);
  const meta: string[] = [];

  if (spa.hours !== null && spa.hours.trim() !== '') {
    meta.push(
      `<li><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>${model.locale === 'en' ? 'Open daily · ' : 'Ouvert tous les jours · '}<b>${escapeHtml(spa.hours)}</b>${spa.phone !== null ? ` · ${escapeHtml(spa.phone)}` : ''}</span></li>`,
    );
  } else if (spa.phone !== null) {
    meta.push(`<li>${ICON_PHONE}<span>${escapeHtml(spa.phone)}</span></li>`);
  }

  if (spa.features.length > 0) {
    meta.push(
      `<li><svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16M4 12c0-4 3-7 8-7s8 3 8 7M4 12c0 4 3 7 8 7s8-3 8-7"/></svg><span>${escapeHtml(spa.features.join(', '))}</span></li>`,
    );
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
    meta.push(
      `<li><svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16M4 12c0-4 3-7 8-7s8 3 8 7M4 12c0 4 3 7 8 7s8-3 8-7"/></svg><span>${escapeHtml(parts.join(', '))}</span></li>`,
    );
  }

  if (spa.tip !== null && spa.tip.trim() !== '') {
    meta.push(`<li>${ICON_LOC}<span>${escapeHtml(spa.tip)}</span></li>`);
  }

  const priceBlock =
    spa.priceNote !== null && spa.priceNote.trim() !== ''
      ? `<p class="fb-price">${escapeHtml(spa.priceNote)}<small>${model.locale === 'en' ? ' on request with the concierge' : ' sur réservation auprès de la conciergerie'}</small></p>`
      : '';

  const moreHrefRaw = spa.website ?? spa.reservationUrl ?? model.reservationBasePath;
  const moreHref = moreHrefRaw.startsWith('http')
    ? (localizeKitOfficialHref(moreHrefRaw, model.locale) ?? moreHrefRaw)
    : moreHrefRaw;
  const moreExternal = moreHref.startsWith('http');

  return `<div class="bref-sub">
        <h3>${model.locale === 'en' ? 'Spa & wellness' : 'Spa & bien-être'}</h3>
        <div class="feature-block">
          <div class="fb-media mini-gallery">
            <div class="mg-track">
              <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy">
            </div>
            <div class="mg-dots"><span class="on"></span></div>
          </div>
          <div class="fb-tx">
            <h4>${escapeHtml(spa.name)}</h4>
            ${spa.description !== null ? `<p>${escapeHtml(spa.description)}</p>` : ''}
            ${meta.length > 0 ? `<ul class="fb-meta">${meta.join('\n              ')}</ul>` : ''}
            ${priceBlock}
            <a href="${escapeHtml(moreHref)}" class="link-or fb-more-link"${moreExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${model.locale === 'en' ? 'Learn more →' : 'En savoir plus →'}</a>
          </div>
        </div>
      </div>`;
}

function renderKidClubBlock(model: HotelKitModel): string {
  const kidClubs = model.signatureExperiences.filter((e) => e.kind === 'kid_club');
  if (kidClubs.length === 0) return '';

  return kidClubs
    .map((k) => {
      const img =
        k.imagePublicId !== null
          ? {
              src: buildCloudinarySrc({
                cloudName: model.cloudName,
                publicId: k.imagePublicId,
                transforms: 'f_auto,q_auto,c_fill,g_auto,w_900,h_675',
              }),
              alt: k.title,
            }
          : model.media.kidClub(k.title);
      return `<div class="bref-sub">
        <h3>${model.locale === 'en' ? 'Kids Club' : 'Kids Club'}</h3>
        <div class="feature-block reverse">
          <div class="fb-media mini-gallery">
            <div class="mg-track">
              <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy">
            </div>
            <div class="mg-dots"><span class="on"></span></div>
          </div>
          <div class="fb-tx">
            <h4>${escapeHtml(k.title)}</h4>
            <p>${escapeHtml(k.description)}</p>
            <ul class="fb-meta">
              <li><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg><span>${model.locale === 'en' ? 'From <b>4 years</b>' : 'À partir de <b>4 ans</b>'}</span></li>
              <li>${ICON_CHECK}<span>${model.locale === 'en' ? 'Creative workshops, treasure hunts, secure pool' : 'Ateliers créatifs, chasses au trésor, piscine sécurisée'}</span></li>
            </ul>
            <p class="fb-price">${model.locale === 'en' ? 'Included for resident children' : 'Accès inclus pour les enfants des résidents'}</p>
            ${(() => {
              const link = resolveKitLearnMoreLink(model, k);
              return `<a href="${escapeHtml(link.href)}" class="link-or fb-more-link"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(link.label)}</a>`;
            })()}
          </div>
        </div>
      </div>`;
    })
    .join('\n');
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
  const visible = model.roomCards.slice(0, 3);
  const cards = visible.map((r) => renderRoomCard(model, r)).join('\n\n          ');
  const lede =
    model.locale === 'en'
      ? `${model.roomCount} rooms and suites — our Concierge's priority selection.`
      : `${model.roomCount} chambres et suites — voici la sélection que nous recommandons en priorité.`;
  return `<section class="htl-section" id="chambres">
      <h2>${escapeHtml(model.labels.roomsSectionTitle)}</h2>
      <p class="htl-lede">${escapeHtml(lede)}</p>
      <div class="rooms-grid">
          ${cards}
      </div>
      <div class="rooms-more">
        <a href="#chambres" class="btn-ligne">${escapeHtml(model.labels.roomsMore)} →</a>
      </div>
    </section>`;
}

export function renderKitBref(model: HotelKitModel): string {
  const amenHtml = resolveKitAmenityBlocks(model.slugFr)
    .map((block) => {
      const title = model.locale === 'en' ? block.titleEn : block.titleFr;
      const detail = model.locale === 'en' ? block.descEn : block.descFr;
      return `<div class="amen">${amenityIconHtml(block.icon)}<b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span></div>`;
    })
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
          const ledeHtml =
            ledePara !== undefined ? `<p class="sub-lede">${escapeProseHtml(ledePara)}</p>` : '';
          const paras = restParas
            .map((p) => `<p class="histoire-txt">${escapeProseHtml(p)}</p>`)
            .join('\n        ');
          return `<div class="bref-sub bref-histoire">
        <h3>${escapeHtml(section.title)}</h3>
        ${ledeHtml}
        ${paras}
      </div>`;
        })()
      : '';

  const expList = orderKitSignatureExperiences(
    model.signatureExperiences.filter((e) => e.kind !== 'kid_club'),
  );
  const expHtml = expList
    .map((exp, i) => {
      const isPick = isKitSignatureExperienceConciergePick(exp);
      const imgTile =
        exp.imagePublicId !== null
          ? {
              src: buildCloudinarySrc({
                cloudName: model.cloudName,
                publicId: exp.imagePublicId,
                transforms: 'f_auto,q_auto,c_fill,g_auto,w_700,h_525',
              }),
              alt: exp.title,
            }
          : model.media.experienceAt(i, exp.title);
      const imgSrc = imgTile.src;
      const hidden = i >= 3 ? ' more-hidden' : '';
      const pick = isPick
        ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(model.labels.conciergePick)}</span>`
        : '';
      return `<article class="exp-card${isPick ? ' exp-concierge' : ''}${hidden}">
            <div class="exp-img">
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(exp.title)}" loading="lazy">
              ${pick}
            </div>
            <div class="exp-tx">
              <h4>${escapeHtml(exp.title)}</h4>
              <p>${escapeHtml(exp.description)}</p>
              ${isPick && exp.tip !== null && exp.tip.trim() !== '' ? `<p class="cc-why">${escapeHtml(exp.tip.trim())}</p>` : ''}
              <div class="exp-foot">
                <span class="exp-price">${formatExperiencePrice(model, exp)}</span>
                ${(() => {
                  const link = resolveKitLearnMoreLink(model, exp);
                  return `<a href="${escapeHtml(link.href)}" class="link-or"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(link.label)}</a>`;
                })()}
              </div>
            </div>
          </article>`;
    })
    .join('\n          ');

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
      const hidden = i >= 3 ? ' more-hidden' : '';
      return `<article class="${cardClass}${hidden}">
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
      <div class="bref-sub">
        <h3>${model.locale === 'en' ? 'Services & amenities' : 'Services & équipements'}</h3>
        <p class="sub-lede">${model.locale === 'en' ? `${model.amenitiesFlat.length} services and amenities — palace essentials without excess.` : `${model.amenitiesFlat.length} services et équipements, de la conciergerie 24h/24 au Wi-Fi gratuit. L'essentiel d'un palace, sans surenchère.`}</p>
        <div class="amen-grid">
          ${amenHtml}
        </div>
      </div>
      ${
        expList.length > 0
          ? `<div class="bref-sub">
        <h3>${model.locale === 'en' ? 'Signature experiences' : 'Expériences signature'}</h3>
        <p class="sub-lede">${model.locale === 'en' ? 'What the concierge arranges for you, beyond the room.' : 'Ce que la conciergerie organise pour vous, au-delà de la chambre.'}</p>
        <div class="exp-list${expList.length > 3 ? ' is-collapsed' : ''}" id="exp-list-container">
          ${expHtml}
        </div>
        ${
          expList.length > 3
            ? `<div class="exp-more-wrap">
          <button type="button" class="btn-ligne exp-toggle-btn" data-toggle-more="exp-list-container" id="btn-voir-exp" aria-expanded="false" data-more="${model.locale === 'en' ? 'See more' : 'Voir plus'}" data-less="${model.locale === 'en' ? 'See less' : 'Voir moins'}">${model.locale === 'en' ? 'See more' : 'Voir plus'}</button>
        </div>`
            : ''
        }
      </div>`
          : ''
      }
      ${
        restos.length > 0
          ? `<div class="bref-sub">
        <h3>Restaurants &amp; bars</h3>
        <p class="sub-lede">${model.locale === 'en' ? 'Six addresses under one roof. Our favourite table wears the Concierge badge.' : 'Six adresses sous le même toit. Notre table préférée porte le badge du Concierge.'}</p>
        <div class="resto-grid${restos.length > 3 ? ' is-collapsed' : ''}" id="resto-list-container">
          ${restoHtml}
        </div>
        ${
          restos.length > 3
            ? `<div class="resto-more-wrap">
          <button type="button" class="btn-ligne resto-toggle-btn" data-toggle-more="resto-list-container" id="btn-voir-resto" aria-expanded="false" data-more="${model.locale === 'en' ? 'See more' : 'Voir plus'}" data-less="${model.locale === 'en' ? 'See less' : 'Voir moins'}">${model.locale === 'en' ? 'See more' : 'Voir plus'}</button>
        </div>`
            : ''
        }
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

function renderKitStaticMapHtml(model: HotelKitModel): string {
  if (model.latitude === null || model.longitude === null) return '';
  const accessToken = getMapboxAccessToken();
  if (accessToken === null) return '';
  const imageUrl = buildMapboxStaticImageUrl({
    latitude: model.latitude,
    longitude: model.longitude,
    accessToken,
  });
  const mapHref = buildMapboxExternalMapHref(model.latitude, model.longitude);
  const viewMapLabel = model.locale === 'en' ? 'View on the map' : 'Voir sur la carte';
  return `<figure class="kit-static-map">
      <img
        src="${escapeHtml(imageUrl)}"
        alt="${escapeHtml(model.labels.staticMapAlt)}"
        width="800"
        height="360"
        loading="lazy"
        decoding="async"
        class="kit-static-map__embed"
      />
      <figcaption class="kit-static-map__attr">
        ${model.labels.mapAttributionHtml}
        <a href="${escapeHtml(mapHref)}" target="_blank" rel="noopener noreferrer" class="kit-static-map__open">${escapeHtml(viewMapLabel)}</a>
      </figcaption>
    </figure>`;
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

  const coordsItems: string[] = [];
  if (fullAddress.length > 0) {
    coordsItems.push(`<li>${ICON_LOC}${escapeHtml(fullAddress)}</li>`);
  }
  if (model.phone !== null) {
    coordsItems.push(`<li>${ICON_PHONE}${escapeHtml(model.phone)}</li>`);
  }
  if (model.emailReservations !== null) {
    coordsItems.push(
      `<li>${ICON_EMAIL}<a href="mailto:${escapeHtml(model.emailReservations)}">${escapeHtml(model.emailReservations)}</a></li>`,
    );
  }
  if (model.officialWebsiteUrl !== null) {
    const officialHref = localizeKitOfficialHref(model.officialWebsiteUrl, model.locale);
    if (officialHref !== null) {
      coordsItems.push(
        `<li>${ICON_LOC}<a href="${escapeHtml(officialHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.labels.officialWebsite)}</a></li>`,
      );
    }
  }
  if (model.googleMapsUrl !== null) {
    coordsItems.push(
      `<li>${ICON_LOC}<a href="${escapeHtml(model.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.labels.googleListing)}</a></li>`,
    );
  }

  const policyItems = policyLines
    .map((line) => `<li>${ICON_CHECK}${escapeHtml(line)}</li>`)
    .join('\n            ');
  const accessItems = accessLines
    .map((line) => `<li>${ICON_LOC}${escapeHtml(line)}</li>`)
    .join('\n            ');

  const mapBlock = renderKitStaticMapHtml(model);

  const reviewCards: string[] = [];
  const googleQuotes = model.googleReviews.slice(0, 3);
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
        <div class="review-grid">${reviewCards.join('\n          ')}</div>
      </div>`
      : '';

  if (
    coordsItems.length === 0 &&
    policyItems.length === 0 &&
    accessItems.length === 0 &&
    mapBlock.length === 0 &&
    reviewsHtml.length === 0
  ) {
    return '';
  }

  return `<section class="htl-section" id="acces">
      <h2>${escapeHtml(model.labels.access)}</h2>
      <div class="access-grid">
        ${
          coordsItems.length > 0
            ? `<div class="access-card"><h4>${escapeHtml(model.labels.accessCoordsTitle)}</h4><ul>${coordsItems.join('\n            ')}</ul></div>`
            : ''
        }
        ${
          policyItems.length > 0
            ? `<div class="access-card"><h4>${escapeHtml(model.labels.accessPoliciesTitle)}</h4><ul>${policyItems}</ul></div>`
            : ''
        }
      </div>
      ${
        accessItems.length > 0
          ? `<div class="access-card" style="margin-bottom:22px"><h4>${escapeHtml(model.labels.accessTransportTitle)}</h4><ul>${accessItems}</ul></div>`
          : ''
      }
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
): string {
  const pois = model.locationBuckets[bucket];
  if (pois.length === 0) return '';
  const items = pois
    .map((p, i) => {
      const hidden = i >= 3 ? ' more-hidden' : '';
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
      const body = `${pickInline}${category}
            <h5>${escapeHtml(p.name)}</h5>
            <p>${renderPoiParagraph(model, p)}</p>
            ${i === 0 && isPick ? renderPoiConciergeWhy(p, useConciergeFrame) : ''}
            ${website}`;
      if (p.imagePublicId !== null) {
        const imgSrc = buildCloudinarySrc({
          cloudName: model.cloudName,
          publicId: p.imagePublicId,
          transforms: 'f_auto,q_auto,c_fill,g_auto,w_520,h_400',
        });
        return `<div class="around-item has-img${pickClass}${hidden}">
            <div class="around-img">
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy">
              ${pickOnImage}
            </div>
            <div class="around-body">
              ${body}
            </div>
          </div>`;
      }
      return `<div class="around-item${pickClass}${hidden}">
            ${pickCorner}
            ${body}
          </div>`;
    })
    .join('\n          ');
  return `<div class="around-sub">
        <h3>${escapeHtml(title)}</h3>
        <div class="around-list" data-around-list>
          ${items}
        </div>
        ${
          pois.length > 3
            ? `<div class="around-more-wrap"><button type="button" class="btn-ligne around-toggle-btn">${model.locale === 'en' ? 'See more' : 'Voir plus'}</button></div>`
            : ''
        }
      </div>`;
}

function renderUpcomingEventMeta(ev: HotelKitModel['upcomingEvents'][number]): string {
  const parts: string[] = [];
  if (ev.period !== null && ev.period.length > 0) {
    parts.push(`<span class="around-cat">${escapeHtml(ev.period)}</span>`);
  }
  if (ev.schedule !== null && ev.schedule.length > 0) {
    parts.push(`<span class="around-schedule">${escapeHtml(ev.schedule)}</span>`);
  }
  if (parts.length === 0) return '';
  return `<p class="around-meta">${parts.join('')}</p>`;
}

function renderUpcomingEventsSub(model: HotelKitModel): string {
  const events = model.upcomingEvents;
  if (events.length === 0) return '';
  const title = model.locale === 'en' ? 'During your stay' : 'Ce qui se passe pendant votre séjour';
  const items = events
    .map((ev, i) => {
      const hidden = i >= 3 ? ' more-hidden' : '';
      const isPick = i === 1;
      const pick = isPick
        ? `<span class="cc-pick">${ICON_STAR}${escapeHtml(model.labels.conciergePick)}</span>`
        : '';
      const desc = ev.description ?? '';
      const why =
        i === 1 && desc.includes('Ambiance unique')
          ? `<p class="cc-why cc-why-sm">${model.locale === 'en' ? 'Unique atmosphere: estate organic wine, live music and stars. Book ahead — evenings sell out.' : 'Ambiance unique : le vin bio du domaine, la musique live et les étoiles. Réservez à l’avance, les soirées affichent complet.'}</p>`
          : '';
      const body =
        i === 1 && desc.includes('Ambiance unique')
          ? escapeHtml(desc.split('Ambiance unique')[0]?.trim() ?? desc)
          : escapeHtml(desc);
      const meta = renderUpcomingEventMeta(ev);
      const link =
        ev.url !== null
          ? `<a href="${escapeHtml(ev.url)}" class="link-or around-link" target="_blank" rel="noopener noreferrer">${model.locale === 'en' ? 'Details →' : 'En savoir plus →'}</a>`
          : '';
      return `<div class="around-item${isPick ? ' around-concierge' : ''}${hidden}">
            ${pick}
            <h5>${escapeHtml(ev.name)}</h5>
            ${meta}
            <p>${body}</p>
            ${why}
            ${link}
          </div>`;
    })
    .join('\n          ');
  return `<div class="around-sub">
        <h3>${escapeHtml(title)}</h3>
        <div class="around-list" data-around-list>
          ${items}
        </div>
        ${
          events.length > 3
            ? `<div class="around-more-wrap"><button type="button" class="btn-ligne around-toggle-btn">${model.locale === 'en' ? 'See more' : 'Voir plus'}</button></div>`
            : ''
        }
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

export function renderKitAutour(model: HotelKitModel): string {
  const bucketTitles = {
    visit: { fr: "Ce qu'on visite dans le quartier", en: 'What to visit nearby' },
    do: { fr: "Ce qu'on y fait", en: 'What to do' },
    eat: { fr: 'Restaurants & bars autour', en: 'Restaurants & bars nearby' },
    shop: { fr: 'Commerces à proximité', en: 'Shopping nearby' },
  } as const;

  const subs = [
    renderAroundBucket(model, 'visit', bucketTitles.visit[model.locale]),
    renderAroundBucket(model, 'do', bucketTitles.do[model.locale]),
    renderUpcomingEventsSub(model),
    renderAroundBucket(model, 'eat', bucketTitles.eat[model.locale]),
    renderAroundBucket(model, 'shop', bucketTitles.shop[model.locale]),
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
      const open = !options.concierge && options.groupIndex === 0 && itemIdx === 0 ? ' open' : '';
      const conciergeClass = options.concierge ? ' faq-concierge' : '';
      return `<details class="faq-item${conciergeClass}${hidden}"${open}><summary>${escapeHtml(item.question)}</summary>${options.renderAnswer(item)}</details>`;
    })
    .join('\n        ');

  const toggle = hasMore
    ? `<div class="faq-more-wrap"><button type="button" class="btn-ligne faq-toggle-btn" aria-expanded="false" data-more="${escapeHtml(seeMore)}" data-less="${escapeHtml(seeLess)}">${escapeHtml(seeMore)}</button></div>`
    : '';

  return `<div class="faq-group">
        <h3>${escapeHtml(label)}</h3>
        <div class="faq-list${collapsedClass}" data-faq-list>${details}</div>
        ${toggle}
      </div>`;
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
  return `<section class="htl-section" id="faq">
      <h2>${escapeHtml(model.labels.faq)}</h2>
      <p class="htl-lede">${escapeHtml(model.labels.faqLede)}</p>
      ${groups}
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
  return `<section class="htl-section" id="proximite" style="border-bottom:none">
      <h2>${escapeHtml(model.labels.proximity)}</h2>
      <p class="htl-lede">${escapeHtml(model.labels.proximityLede)}</p>
      <div class="nearby-grid">${grid}</div>
      <div class="nearby-region">
        <a href="${p}/destination/${escapeHtml(model.cityHubSlug)}" class="btn-ligne">${escapeHtml(model.labels.exploreRegion)}</a>
      </div>
    </section>`;
}

/** Shell + main column (DA layout). Aside is rendered in React. */
export function assembleHotelKitShell(model: HotelKitModel): {
  readonly prefixHtml: string;
  readonly mainHtml: string;
} {
  const main = [
    renderKitHead(model),
    renderKitFeats(model),
    renderKitSectionNav(model),
    renderKitFactualSummary(model),
    renderKitApropos(model),
    renderKitChambres(model),
    renderKitBref(model),
    renderKitClub(model),
    renderKitPresse(model),
    renderKitAcces(model),
    renderKitAutour(model),
    renderKitConciergeAdvice(model),
    ...(model.conciergeQuestionGroups.length === 0 ? [renderKitTopConciergeFaq(model)] : []),
    renderKitFaq(model),
    renderKitConciergeQuestions(model),
    renderKitProximite(model),
    renderKitEnBref(model),
  ].join('\n\n    ');
  return {
    prefixHtml: renderKitBreadcrumb(model),
    mainHtml: main,
  };
}
