/**
 * Loads kit-wave JSON payloads and builds golden `public.hotels` field maps.
 *
 * Wave 5 fiches use dedicated `{slug}-golden.ts` modules instead; this loader
 * remains for future JSON-driven rollouts once payloads are generated.
 */

import { dropCannibalizingSections, resolvePopulatedBlocks } from './golden-template';
import type { KitGoldenInput, KitGoldenPayload } from './kit-golden-types';

export const KIT_WAVE_SLUGS = [
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-airelles-courchevel',
  'les-pres-deugenie',
  'shangri-la-paris',
] as const;

export type KitWaveSlug = (typeof KIT_WAVE_SLUGS)[number];

const PAYLOADS: Readonly<Record<string, KitGoldenPayload>> = {};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function patchAmenities(payload: KitGoldenPayload, existing: unknown): readonly unknown[] {
  const base = Array.isArray(existing) ? (existing as unknown[]) : [];
  const keys = new Set(
    base
      .map((item) => {
        const rec = asRecord(item);
        return rec !== null && typeof rec['key'] === 'string' ? rec['key'] : null;
      })
      .filter((k): k is string => k !== null),
  );
  const merged = [...base];
  for (const amenity of payload.amenities) {
    if (!keys.has(amenity.key)) {
      merged.push(amenity);
      keys.add(amenity.key);
    }
  }
  return merged;
}

function patchSpa(payload: KitGoldenPayload, existing: unknown): unknown {
  const base = asRecord(existing) ?? {};
  const patch = asRecord(payload.spaInfo) ?? {};
  return { ...base, ...patch };
}

function patchPolicies(existing: unknown): unknown {
  const base = asRecord(existing) ?? {};
  if (base['check_in'] !== undefined && base['check_out'] !== undefined) return base;
  return {
    ...base,
    check_in: base['check_in'] ?? {
      time: '15:00',
      notes_fr: 'Arrivée dès 15h ; early check-in selon disponibilité auprès de la conciergerie.',
      notes_en: 'Arrival from 3 pm; early check-in subject to availability through the concierge.',
    },
    check_out: base['check_out'] ?? {
      time: '12:00',
      notes_fr: 'Départ jusqu’à 12h ; late check-out selon disponibilité.',
      notes_en: 'Departure until noon; late check-out subject to availability.',
    },
    wifi: base['wifi'] ?? { included: true, scope: 'whole_property' },
  };
}

function resolveLongSections(
  payload: KitGoldenPayload,
  current: KitGoldenInput,
  spaInfo: unknown,
): unknown {
  const populated = resolvePopulatedBlocks({
    restaurantInfo: payload.restaurantInfo,
    spaInfo,
    pointsOfInterest: payload.pointsOfInterest,
  });
  const source =
    Array.isArray(current.long_description_sections) &&
    (current.long_description_sections as unknown[]).length > 0
      ? current.long_description_sections
      : [];
  return dropCannibalizingSections(source, populated);
}

export function getKitGoldenPayload(slug: string): KitGoldenPayload | null {
  return PAYLOADS[slug] ?? null;
}

export function isKitWaveSlug(slug: string): slug is KitWaveSlug {
  return (KIT_WAVE_SLUGS as readonly string[]).includes(slug);
}

export function buildKitGoldenFieldsFromPayload(
  slug: string,
  current: KitGoldenInput,
): Record<string, unknown> | null {
  const payload = getKitGoldenPayload(slug);
  if (payload === null) return null;

  const spaInfo = patchSpa(payload, current.spa_info);
  const fields: Record<string, unknown> = {
    restaurant_info: payload.restaurantInfo,
    points_of_interest: payload.pointsOfInterest,
    spa_info: spaInfo,
    concierge_advice: payload.conciergeAdvice,
    concierge_hook: payload.conciergeHook,
    concierge_questions: payload.conciergeQuestions,
    faq_content: payload.faqContentPromote,
    amenities: patchAmenities(payload, current.amenities),
    policies: patchPolicies(current.policies),
    awards: current.awards,
    hero_image: payload.heroImage ?? `${payload.imagePrefix}/press-1`,
    gallery_images: payload.galleryImages,
    long_description_sections: resolveLongSections(payload, current, spaInfo),
    signature_experiences:
      payload.signatureExperiences ??
      (Array.isArray(current.signature_experiences) ? current.signature_experiences : []),
  };

  if (payload.faqContentKit !== undefined) fields['faq_content_kit'] = payload.faqContentKit;
  if (payload.highlights !== undefined) fields['highlights'] = payload.highlights;
  if (payload.conciergePick !== undefined) fields['concierge_pick'] = payload.conciergePick;
  if (payload.transports !== undefined) fields['transports'] = payload.transports;
  if (payload.instagram !== undefined) fields['instagram'] = payload.instagram;
  if (payload.miceInfo !== undefined) fields['mice_info'] = payload.miceInfo;
  if (payload.affiliations !== undefined) fields['affiliations'] = payload.affiliations;
  if (payload.externalSources !== undefined) fields['external_sources'] = payload.externalSources;
  if (payload.descriptionFr !== undefined) fields['description_fr'] = payload.descriptionFr;
  if (payload.descriptionEn !== undefined) fields['description_en'] = payload.descriptionEn;
  if (payload.factualSummaryFr !== undefined) {
    fields['factual_summary_fr'] = payload.factualSummaryFr;
  }
  if (payload.factualSummaryEn !== undefined) {
    fields['factual_summary_en'] = payload.factualSummaryEn;
  }
  if (payload.metaTitleFr !== undefined) fields['meta_title_fr'] = payload.metaTitleFr;
  if (payload.metaTitleEn !== undefined) fields['meta_title_en'] = payload.metaTitleEn;
  if (payload.metaDescFr !== undefined) fields['meta_desc_fr'] = payload.metaDescFr;
  if (payload.metaDescEn !== undefined) fields['meta_desc_en'] = payload.metaDescEn;
  if (payload.phoneE164 !== undefined) fields['phone_e164'] = payload.phoneE164;
  if (payload.address !== undefined) fields['address'] = payload.address;
  if (payload.postalCode !== undefined) fields['postal_code'] = payload.postalCode;
  if (payload.latitude !== undefined) fields['latitude'] = payload.latitude;
  if (payload.longitude !== undefined) fields['longitude'] = payload.longitude;
  if (payload.emailReservations !== undefined) {
    fields['email_reservations'] = payload.emailReservations;
  }
  if (payload.googlePlaceId !== undefined) fields['google_place_id'] = payload.googlePlaceId;
  if (payload.openedAt !== undefined) fields['opened_at'] = payload.openedAt;

  return fields;
}
