import 'server-only';

import { localePathPrefix } from '@/i18n/runtime';

/** Escape text for safe HTML injection (DA kit sections). */
export function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Allow editorial `<strong>` in prose paragraphs sourced from CMS. */
export function escapeProseHtml(raw: string): string {
  return escapeHtml(raw)
    .replaceAll('&lt;strong&gt;', '<strong>')
    .replaceAll('&lt;/strong&gt;', '</strong>')
    .replaceAll('&lt;em&gt;', '<em>')
    .replaceAll('&lt;/em&gt;', '</em>');
}

export const ICON_CHECK = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';

export const ICON_STAR =
  '<svg viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z"/></svg>';

/** Star with `.icon` for distinction chips (`.distinction .icon` in kit.css). */
export const ICON_STAR_AWARD =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z"/></svg>';

export const ICON_AREA =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M3 13l9-9 9 9M5 11v9h14v-9"/></svg>';

export const ICON_BED =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M3 18v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6M3 14h18M5 18v2M19 18v2"/></svg>';

export const ICON_AMEN_CONCIERGE =
  '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

export const ICON_AMEN_SPA =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16M4 12c0-4 3-7 8-7s8 3 8 7M4 12c0 4 3 7 8 7s8-3 8-7"/></svg>';

export const ICON_AMEN_DINING =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M6 3v8a6 6 0 0 0 12 0V3M9 21h6"/></svg>';

export const ICON_AMEN_ROOM =
  '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>';

export const ICON_AMEN_ACCESS =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M3 13l9-9 9 9M5 11v9h14v-9"/></svg>';

export const ICON_LOC =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

export const ICON_PHONE =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M4 5h4l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 7a2 2 0 0 1 2-2z"/></svg>';

export const ICON_EMAIL =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>';

export const ICON_CLOCK =
  '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

/** Locale URL prefix — empty for FR (`localePrefix: 'as-needed'`). */
export function localePrefix(locale: 'fr' | 'en'): string {
  return localePathPrefix(locale);
}

export function formatRatingFr(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Qualitative label matching the DA template (`Exceptionnel`, …). */
export function ratingQualitativeLabel(value: number, locale: 'fr' | 'en'): string {
  if (locale === 'en') {
    if (value >= 4.7) return 'Exceptional';
    if (value >= 4.3) return 'Wonderful';
    if (value >= 3.8) return 'Very good';
    if (value >= 3.0) return 'Good';
    return 'Pleasant';
  }
  if (value >= 4.7) return 'Exceptionnel';
  if (value >= 4.3) return 'Fabuleux';
  if (value >= 3.8) return 'Très bien';
  if (value >= 3.0) return 'Bien';
  return 'Agréable';
}

export function formatReviewCount(count: number, locale: 'fr' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR').format(count);
}
