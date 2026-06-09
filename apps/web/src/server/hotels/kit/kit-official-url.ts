import 'server-only';

/** Swap airelles.com locale segment for kit EN pages. */
export function localizeAirellesOfficialUrl(url: string, locale: 'fr' | 'en'): string {
  if (!url.includes('airelles.com/')) return url;
  if (locale === 'en') {
    return url.replace('airelles.com/fr/', 'airelles.com/en/');
  }
  return url.replace('airelles.com/en/', 'airelles.com/fr/');
}

export function isExternalHttpUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://');
}
