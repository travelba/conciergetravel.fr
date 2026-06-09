import type { DayPickerLocale } from 'react-day-picker';
import { enUS, fr } from 'react-day-picker/locale';

import type { Locale } from '@/i18n/routing';

const DAY_PICKER_LOCALES: Record<Locale, DayPickerLocale> = {
  fr,
  en: enUS,
};

/** Locale object for `react-day-picker`, aligned with the active page locale. */
export function getDayPickerLocale(locale: Locale): DayPickerLocale {
  return DAY_PICKER_LOCALES[locale];
}
