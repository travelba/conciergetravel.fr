/**
 * HSM template IDs registered with Meta WhatsApp Business (utility category).
 * Names must match the approved templates in the Business Manager exactly.
 *
 * Placeholders use {{1}}, {{2}}… in Meta; map them in order via `components`.
 */
export type JourneyLocale = 'fr' | 'en';

export type JourneyTouchpoint =
  | 'booking_confirmed'
  | 'pre_arrival_j7'
  | 'pre_arrival_j1'
  | 'arrival_day'
  | 'mid_stay'
  | 'post_stay_j1'
  | 'post_stay_j7_club';

export type TemplateDefinition = {
  readonly name: string;
  readonly locale: JourneyLocale;
  readonly category: 'utility' | 'marketing';
  /** Ordered placeholder keys consumed by the orchestrator. */
  readonly placeholders: readonly string[];
};

const template = (
  name: string,
  locale: JourneyLocale,
  category: 'utility' | 'marketing',
  placeholders: readonly string[],
): TemplateDefinition => ({ name, locale, category, placeholders });

/** FR templates — suffix `_fr` matches Meta locale bundle naming. */
export const WHATSAPP_TEMPLATES_FR = {
  bookingConfirmed: template('mch_journey_welcome_fr', 'fr', 'utility', [
    'guest_first_name',
    'hotel_name',
    'check_in_date',
  ]),
  preArrivalJ7: template('mch_journey_prep_j7_fr', 'fr', 'utility', [
    'guest_first_name',
    'hotel_name',
    'check_in_date',
    'concierge_tip',
  ]),
  preArrivalJ1: template('mch_journey_checkin_j1_fr', 'fr', 'utility', [
    'guest_first_name',
    'hotel_name',
    'check_in_time',
    'hotel_phone',
  ]),
  arrivalDay: template('mch_journey_arrival_fr', 'fr', 'utility', [
    'guest_first_name',
    'hotel_name',
  ]),
  midStay: template('mch_journey_midstay_fr', 'fr', 'utility', ['guest_first_name', 'hotel_name']),
  postStayJ1: template('mch_journey_thanks_j1_fr', 'fr', 'utility', [
    'guest_first_name',
    'hotel_name',
  ]),
  postStayJ7Club: template('mch_journey_club_j7_fr', 'fr', 'marketing', [
    'guest_first_name',
    'club_cta_url',
  ]),
} as const satisfies Record<string, TemplateDefinition>;

/** EN templates — suffix `_en`. */
export const WHATSAPP_TEMPLATES_EN = {
  bookingConfirmed: template('mch_journey_welcome_en', 'en', 'utility', [
    'guest_first_name',
    'hotel_name',
    'check_in_date',
  ]),
  preArrivalJ7: template('mch_journey_prep_j7_en', 'en', 'utility', [
    'guest_first_name',
    'hotel_name',
    'check_in_date',
    'concierge_tip',
  ]),
  preArrivalJ1: template('mch_journey_checkin_j1_en', 'en', 'utility', [
    'guest_first_name',
    'hotel_name',
    'check_in_time',
    'hotel_phone',
  ]),
  arrivalDay: template('mch_journey_arrival_en', 'en', 'utility', [
    'guest_first_name',
    'hotel_name',
  ]),
  midStay: template('mch_journey_midstay_en', 'en', 'utility', ['guest_first_name', 'hotel_name']),
  postStayJ1: template('mch_journey_thanks_j1_en', 'en', 'utility', [
    'guest_first_name',
    'hotel_name',
  ]),
  postStayJ7Club: template('mch_journey_club_j7_en', 'en', 'marketing', [
    'guest_first_name',
    'club_cta_url',
  ]),
} as const satisfies Record<string, TemplateDefinition>;

export function resolveWhatsAppTemplate(
  touchpoint: JourneyTouchpoint,
  locale: JourneyLocale,
): TemplateDefinition {
  const key = touchpointToCatalogKey(touchpoint);
  if (locale === 'fr') {
    return WHATSAPP_TEMPLATES_FR[key];
  }
  return WHATSAPP_TEMPLATES_EN[key];
}

function touchpointToCatalogKey(touchpoint: JourneyTouchpoint): keyof typeof WHATSAPP_TEMPLATES_FR {
  switch (touchpoint) {
    case 'booking_confirmed':
      return 'bookingConfirmed';
    case 'pre_arrival_j7':
      return 'preArrivalJ7';
    case 'pre_arrival_j1':
      return 'preArrivalJ1';
    case 'arrival_day':
      return 'arrivalDay';
    case 'mid_stay':
      return 'midStay';
    case 'post_stay_j1':
      return 'postStayJ1';
    case 'post_stay_j7_club':
      return 'postStayJ7Club';
    default: {
      const _exhaustive: never = touchpoint;
      throw new Error(`Unknown touchpoint: ${String(_exhaustive)}`);
    }
  }
}

/** Build ordered placeholder values for Meta `components.body.parameters`. */
export function buildTemplateParameters(
  definition: TemplateDefinition,
  values: Readonly<Record<string, string>>,
): string[] {
  return definition.placeholders.map((key) => {
    const value = values[key];
    if (value === undefined || value.length === 0) {
      throw new Error(`Missing WhatsApp template placeholder: ${key}`);
    }
    return value;
  });
}
