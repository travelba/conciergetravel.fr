import { z } from 'zod';

import type { HotelCardV2, HotelDetailV2 } from '@mch/db';

import type { DemoHotel, DemoHotelEditorialSection, DemoHotelFaqItem } from '@/lib/demo-data';

const CLOUDINARY = 'https://res.cloudinary.com/travelba/image/upload/f_auto,q_auto,c_fill';

const CloudinaryPublicIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/);

const GalleryImageSchema = z.object({
  public_id: CloudinaryPublicIdSchema,
  alt_fr: z.string().min(1).optional(),
  alt_en: z.string().min(1).optional(),
});

const GalleryImagesSchema = z.array(GalleryImageSchema);

const ConciergeAdviceLocaleSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

const ConciergeAdviceSchema = z.object({
  fr: ConciergeAdviceLocaleSchema,
  en: ConciergeAdviceLocaleSchema.optional(),
});

const ANCHOR_REGEX = /^[a-z][a-z0-9-]{1,40}$/;

const LongDescriptionSectionSchema = z.object({
  anchor: z.string().regex(ANCHOR_REGEX),
  title_fr: z.string().min(1).optional(),
  title_en: z.string().min(1).optional(),
  body_fr: z.string().min(1).optional(),
  body_en: z.string().min(1).optional(),
});

const LongDescriptionSectionsSchema = z.array(LongDescriptionSectionSchema);

const FaqItemSchema = z.object({
  question_fr: z.string().min(1).optional(),
  question_en: z.string().min(1).optional(),
  answer_fr: z.string().min(1).optional(),
  answer_en: z.string().min(1).optional(),
});

const FaqContentSchema = z.array(FaqItemSchema);

const COUNTRY_LABELS: Record<string, string> = {
  FR: 'France',
  GB: 'Royaume-Uni',
  IT: 'Italie',
  ES: 'Espagne',
  MA: 'Maroc',
  JP: 'Japon',
  US: 'États-Unis',
};

const LUXURY_TIER_LABELS: Record<string, string> = {
  palace_atout_france: 'Palace · Atout France',
  relais_chateaux: 'Relais & Châteaux',
  forbes_five_star: 'Forbes Five Star',
  michelin_key: 'Clé Michelin',
};

export function cloudinaryDeliveryUrl(
  publicId: string | null,
  width: number,
  height: number,
): string {
  if (publicId === null || publicId.length === 0) {
    return `${CLOUDINARY},w_${width},h_${height}/placeholder-hotel`;
  }
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId;
  }
  return `${CLOUDINARY},w_${width},h_${height}/${publicId}`;
}

function countrySlugFromCode(countryCode: string): string {
  const map: Record<string, string> = {
    FR: 'france',
    GB: 'royaume-uni',
    IT: 'italie',
    ES: 'espagne',
    MA: 'maroc',
    JP: 'japon',
    US: 'etats-unis',
  };
  return map[countryCode] ?? countryCode.toLowerCase();
}

function citySlugFromName(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickLocalizedText(
  locale: 'fr' | 'en',
  fr: string | null | undefined,
  en: string | null | undefined,
): string | null {
  if (locale === 'en' && en !== null && en !== undefined && en.length > 0) return en;
  if (fr !== null && fr !== undefined && fr.length > 0) return fr;
  return null;
}

function readConciergeAdviceBody(raw: unknown, locale: 'fr' | 'en'): string | null {
  const parsed = ConciergeAdviceSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (locale === 'en' && parsed.data.en !== undefined) return parsed.data.en.body;
  return parsed.data.fr.body;
}

function readEditorialSections(
  raw: unknown,
  locale: 'fr' | 'en',
): readonly DemoHotelEditorialSection[] {
  const parsed = LongDescriptionSectionsSchema.safeParse(raw);
  if (!parsed.success) return [];

  const out: DemoHotelEditorialSection[] = [];
  for (const section of parsed.data) {
    const title = pickLocalizedText(locale, section.title_fr, section.title_en);
    const body = pickLocalizedText(locale, section.body_fr, section.body_en);
    if (title === null || body === null) continue;
    const paragraphs = body
      .split(/\r?\n\r?\n+/u)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) continue;
    out.push({ anchor: section.anchor, title, paragraphs });
  }
  return out;
}

function readFaqContent(raw: unknown, locale: 'fr' | 'en'): readonly DemoHotelFaqItem[] {
  const parsed = FaqContentSchema.safeParse(raw);
  if (!parsed.success) return [];

  const out: DemoHotelFaqItem[] = [];
  for (const item of parsed.data) {
    const question = pickLocalizedText(locale, item.question_fr, item.question_en);
    const answer = pickLocalizedText(locale, item.answer_fr, item.answer_en);
    if (question === null || answer === null) continue;
    out.push({ question, answer });
  }
  return out;
}

function readGalleryPhotos(
  raw: unknown,
  locale: 'fr' | 'en',
  fallbackName: string,
  heroPublicId: string | null,
): DemoHotel['photos'] {
  const parsed = GalleryImagesSchema.safeParse(raw);
  if (!parsed.success || parsed.data.length === 0) {
    const hero = cloudinaryDeliveryUrl(heroPublicId, 1200, 800);
    return [{ id: 'hero', alt: fallbackName, src: hero }];
  }
  return parsed.data.slice(0, 12).map((img, index) => ({
    id: String(index + 1),
    alt: pickLocalizedText(locale, img.alt_fr, img.alt_en) ?? fallbackName,
    src: cloudinaryDeliveryUrl(img.public_id, 800, 600),
  }));
}

function amenitiesToHighlights(facet: HotelCardV2['amenities_facet']): string[] {
  const highlights: string[] = [];
  if (facet.has_spa === true) highlights.push('Spa');
  if (facet.has_pool === true) highlights.push('Piscine');
  if (facet.has_restaurant === true) highlights.push('Restaurant');
  if (facet.has_gym === true) highlights.push('Fitness');
  if (facet.wifi === true) highlights.push('Wi-Fi');
  return highlights.slice(0, 4);
}

function priceMinorFromHint(priceHint: number | null): number {
  if (priceHint === null || priceHint <= 0) return 0;
  return priceHint >= 1000 ? priceHint : priceHint * 100;
}

function editorialBadgeFromTier(luxuryTier: string | null): string | undefined {
  if (luxuryTier === null || luxuryTier.length === 0) return undefined;
  return LUXURY_TIER_LABELS[luxuryTier] ?? luxuryTier.replace(/_/g, ' ');
}

export function mapHotelCardV2ToDemoHotel(card: HotelCardV2, locale: 'fr' | 'en'): DemoHotel {
  const name =
    locale === 'en' && card.name_en !== null && card.name_en.length > 0 ? card.name_en : card.name;
  const publicPriceMinor = priceMinorFromHint(card.price_hint);
  const memberPriceMinor = publicPriceMinor > 0 ? Math.round(publicPriceMinor * 0.8) : 0;

  const editorialBadge = editorialBadgeFromTier(card.luxury_tier);

  return {
    slug: card.slug,
    name,
    stars: card.stars,
    city: card.city,
    country: COUNTRY_LABELS[card.country_code] ?? card.country_code,
    countrySlug: countrySlugFromCode(card.country_code),
    citySlug: citySlugFromName(card.city),
    district: card.city,
    distanceLabel: '',
    ratingScoreOutOfTen: card.rating_score ?? 0,
    reviewCount: card.rating_count ?? 0,
    ...(editorialBadge !== undefined ? { editorialBadge } : {}),
    highlights: amenitiesToHighlights(card.amenities_facet),
    heroImage: cloudinaryDeliveryUrl(card.hero_image, 1600, 900),
    photos: readGalleryPhotos(null, locale, name, card.hero_image),
    description: '',
    conciergeAdvice: '',
    editorialSections: [],
    faq: [],
    publicPriceMinor,
    memberPriceMinor,
    rooms: [],
  };
}

export function mapHotelDetailV2ToDemoHotel(detail: HotelDetailV2, locale: 'fr' | 'en'): DemoHotel {
  const base = mapHotelCardV2ToDemoHotel(detail, locale);
  const name =
    locale === 'en' && detail.name_en !== null && detail.name_en.length > 0
      ? detail.name_en
      : detail.name;
  const description =
    pickLocalizedText(locale, detail.description_fr, detail.description_en) ??
    pickLocalizedText(locale, detail.factual_summary_fr, detail.factual_summary_en) ??
    '';
  const conciergeAdvice = readConciergeAdviceBody(detail.concierge_advice, locale) ?? '';
  const editorialSections = readEditorialSections(detail.long_description_sections, locale);
  const faq = readFaqContent(detail.faq_content, locale);

  return {
    ...base,
    name,
    district: detail.district ?? detail.city,
    description,
    conciergeAdvice,
    editorialSections,
    faq,
    photos: readGalleryPhotos(detail.gallery_images, locale, name, detail.hero_image),
    heroImage: cloudinaryDeliveryUrl(detail.hero_image, 1600, 900),
  };
}
