import 'server-only';

/** Brand-neutral kit static assets — used when Cloudinary data is missing (non-Airelles slugs). */
export const KIT_GENERIC_ASSETS = {
  club: '/kit/img/club_concierge.jpg',
  dining: '/kit/img/htl_resto.jpg',
  spa: '/kit/img/htl_spa.jpg',
  proximity: '/kit/img/htl_facade.jpg',
  experience: ['/kit/img/experience.jpg', '/kit/img/paris.jpg', '/kit/img/htl_facade.jpg'] as const,
} as const;

export function isAirellesKitSlug(slugFr: string): boolean {
  return slugFr === 'les-airelles-gordes';
}

export function resolveKitClubIllustration(model: {
  readonly slugFr: string;
  readonly locale: 'fr' | 'en';
  readonly name: string;
}): { readonly src: string; readonly alt: string } {
  const src = isAirellesKitSlug(model.slugFr)
    ? '/kit/airelles/club-concierge.jpg'
    : KIT_GENERIC_ASSETS.club;
  const alt =
    model.locale === 'en'
      ? `Le Concierge Club benefits at ${model.name}`
      : `Avantages Le Concierge Club à ${model.name}`;
  return { src, alt };
}
