import 'server-only';

import type { JsonLd } from '@mch/seo';

import type { HotelExternalIds } from '@/server/hotels/get-hotel-by-slug';

export function buildGoogleMapsHasMapUrl(params: {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly googleMapsUrl: string | null;
}): string | undefined {
  if (params.googleMapsUrl !== null && /^https:\/\//iu.test(params.googleMapsUrl)) {
    return params.googleMapsUrl;
  }
  if (params.latitude !== null && params.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${params.latitude},${params.longitude}`;
  }
  return undefined;
}

export type HotelKnowledgeGraphJsonLdFields = Pick<
  JsonLd.HotelJsonLdInput,
  'wikidataId' | 'sameAs' | 'subjectOf' | 'email' | 'hasMap' | 'architects'
>;

export function buildHotelKnowledgeGraphJsonLdFields(params: {
  readonly externalIds: HotelExternalIds;
  readonly name: string;
  readonly bookingMode: string;
  readonly emailReservations: string | null;
  readonly googleMapsUrl: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly officialUrlFallback?: string | null;
}): HotelKnowledgeGraphJsonLdFields {
  const fields: {
    wikidataId?: string;
    sameAs?: readonly string[];
    subjectOf?: JsonLd.HotelJsonLdInput['subjectOf'];
    email?: string;
    hasMap?: string;
    architects?: readonly string[];
  } = {};

  if (params.externalIds.wikidataId !== null) {
    fields.wikidataId = params.externalIds.wikidataId;
  }

  if (params.externalIds.sameAs.length > 0) {
    fields.sameAs = params.externalIds.sameAs;
  } else {
    const fallback =
      params.officialUrlFallback?.trim() ?? params.externalIds.officialUrl?.trim() ?? '';
    if (fallback.startsWith('https://')) {
      fields.sameAs = [fallback];
    }
  }

  const subjectOf: NonNullable<JsonLd.HotelJsonLdInput['subjectOf']>[number][] = [];
  if (params.externalIds.wikipediaUrlFr !== null) {
    subjectOf.push({
      url: params.externalIds.wikipediaUrlFr,
      name: `${params.name} — Wikipédia`,
      inLanguage: 'fr',
    });
  }
  if (params.externalIds.wikipediaUrlEn !== null) {
    subjectOf.push({
      url: params.externalIds.wikipediaUrlEn,
      name: `${params.name} — Wikipedia`,
      inLanguage: 'en',
    });
  }
  if (params.externalIds.commonsGalleryUrl !== null) {
    subjectOf.push({
      url: params.externalIds.commonsGalleryUrl,
      name: `${params.name} — Wikimedia Commons`,
    });
  }
  if (subjectOf.length > 0) {
    fields.subjectOf = subjectOf;
  }

  const email = params.emailReservations ?? params.externalIds.emailReservations;
  if (email !== null && params.bookingMode === 'email') {
    fields.email = email;
  }

  if (params.externalIds.knowledgeGraph.architects.length > 0) {
    fields.architects = params.externalIds.knowledgeGraph.architects;
  }

  const hasMap = buildGoogleMapsHasMapUrl({
    latitude: params.latitude,
    longitude: params.longitude,
    googleMapsUrl: params.googleMapsUrl,
  });
  if (hasMap !== undefined) {
    fields.hasMap = hasMap;
  }

  return {
    ...(fields.wikidataId !== undefined ? { wikidataId: fields.wikidataId } : {}),
    ...(fields.sameAs !== undefined ? { sameAs: fields.sameAs } : {}),
    ...(fields.subjectOf !== undefined ? { subjectOf: fields.subjectOf } : {}),
    ...(fields.email !== undefined ? { email: fields.email } : {}),
    ...(fields.hasMap !== undefined ? { hasMap: fields.hasMap } : {}),
    ...(fields.architects !== undefined ? { architects: fields.architects } : {}),
  };
}
