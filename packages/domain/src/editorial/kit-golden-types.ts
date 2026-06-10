/**
 * Kit golden payload types — JSON-driven kit rollout for catalogue wave fiches.
 * Each pilot slug ships a `kit-wave/{slug}.json` payload promoted to Supabase
 * and merged at runtime via {@link buildKitGoldenFieldsFromPayload}.
 */

export interface KitGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export interface KitGoldenPayload {
  readonly slug: string;
  readonly imagePrefix: string;
  readonly phoneE164?: string;
  readonly address?: string;
  readonly postalCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly emailReservations?: string;
  readonly googlePlaceId?: string;
  readonly openedAt?: string;
  readonly factualSummaryFr?: string;
  readonly factualSummaryEn?: string;
  readonly metaTitleFr?: string;
  readonly metaTitleEn?: string;
  readonly metaDescFr?: string;
  readonly metaDescEn?: string;
  readonly descriptionFr?: string;
  readonly descriptionEn?: string;
  readonly heroImage?: string;
  readonly restaurantInfo: unknown;
  readonly pointsOfInterest: readonly unknown[];
  readonly spaInfo: unknown;
  readonly conciergeAdvice: unknown;
  readonly conciergeHook: unknown;
  readonly conciergePick?: unknown;
  readonly conciergeQuestions: readonly unknown[];
  readonly faqContentPromote: readonly unknown[];
  readonly faqContentKit?: readonly unknown[];
  readonly highlights?: readonly unknown[];
  readonly amenities: readonly Readonly<{
    readonly key: string;
    readonly label_fr: string;
    readonly label_en: string;
  }>[];
  readonly galleryImages: readonly unknown[];
  readonly signatureExperiences?: readonly unknown[];
  readonly transports?: readonly unknown[];
  readonly instagram?: unknown;
  readonly miceInfo?: unknown;
  readonly affiliations?: readonly unknown[];
  readonly externalSources?: readonly unknown[];
}
