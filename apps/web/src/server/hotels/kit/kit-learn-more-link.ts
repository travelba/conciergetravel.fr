import 'server-only';

import type { LocalisedSignatureExperience } from '@/server/hotels/get-hotel-by-slug';

import { isExternalHttpUrl, localizeAirellesOfficialUrl } from './kit-official-url';
import type { HotelKitModel } from './prepare-hotel-kit-model';

export interface KitLearnMoreLink {
  readonly href: string;
  readonly label: string;
  readonly external: boolean;
}

export function resolveKitLearnMoreLink(
  model: HotelKitModel,
  exp: Pick<LocalisedSignatureExperience, 'website'>,
): KitLearnMoreLink {
  const website = exp.website?.trim() ?? '';
  if (website.length > 0) {
    const href = website.includes('airelles.com/')
      ? localizeAirellesOfficialUrl(website, model.locale)
      : website;
    return {
      href,
      label: model.locale === 'en' ? 'Learn more →' : 'En savoir plus →',
      external: isExternalHttpUrl(href),
    };
  }
  return {
    href: '#resa',
    label: model.locale === 'en' ? 'Arrange with the Concierge →' : 'Organiser avec le Concierge →',
    external: false,
  };
}

export function localizeKitOfficialHref(
  url: string | null | undefined,
  locale: 'fr' | 'en',
): string | null {
  if (url === null || url === undefined || url.trim() === '') return null;
  const trimmed = url.trim();
  if (trimmed.includes('airelles.com/')) {
    return localizeAirellesOfficialUrl(trimmed, locale);
  }
  return trimmed;
}
