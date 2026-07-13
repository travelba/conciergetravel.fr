export type PriceSlotMode = 'concierge' | 'live';

/** Phase 9 comparator row — sourced externally, never estimated in ui-v2. */
export type PriceComparatorRow = {
  source: 'mch_member' | 'mch_public' | 'booking_com' | 'expedia' | 'official_site';
  label: string;
  formattedPrice: string;
};

export type PriceSlotError =
  | { code: 'INVALID_MODE'; message: string }
  | { code: 'INVALID_PUBLIC_PRICE'; message: string };

export type PriceSlotConciergeView = {
  mode: 'concierge';
  headline: 'Prix via le Concierge';
  memberTeaser: string;
};

export type PriceSlotLiveView = {
  mode: 'live';
  publicPriceMinor: number;
  currency: string;
  publicPriceFormatted: string;
  memberPriceMinor: number | null;
  memberPriceFormatted: string | null;
  memberLocked: boolean;
  comparatorEnabled: boolean;
};

export type PriceSlotView = PriceSlotConciergeView | PriceSlotLiveView;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type BuildConciergePriceSlotInput = {
  mode: 'concierge';
  memberTeaser?: string;
};

export type BuildLivePriceSlotInput = {
  mode: 'live';
  publicPriceMinor: number;
  currency: string;
  memberPriceMinor?: number | null;
  isMemberAuthenticated: boolean;
  comparatorEnabled?: boolean;
};

export type BuildPriceSlotInput = BuildConciergePriceSlotInput | BuildLivePriceSlotInput;

const DEFAULT_MEMBER_TEASER = "Les membres économisent jusqu'à 25 %";

export function formatPriceMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
}

export function buildPriceSlotView(
  input: BuildPriceSlotInput,
): Result<PriceSlotView, PriceSlotError> {
  if (input.mode === 'concierge') {
    return {
      ok: true,
      value: {
        mode: 'concierge',
        headline: 'Prix via le Concierge',
        memberTeaser: input.memberTeaser ?? DEFAULT_MEMBER_TEASER,
      },
    };
  }

  if (!Number.isFinite(input.publicPriceMinor) || input.publicPriceMinor <= 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PUBLIC_PRICE',
        message: 'Live mode requires a positive public price in minor units.',
      },
    };
  }

  const memberPriceMinor =
    input.memberPriceMinor !== undefined && input.memberPriceMinor !== null
      ? input.memberPriceMinor
      : null;

  const memberLocked = !input.isMemberAuthenticated;

  return {
    ok: true,
    value: {
      mode: 'live',
      publicPriceMinor: input.publicPriceMinor,
      currency: input.currency,
      publicPriceFormatted: formatPriceMinor(input.publicPriceMinor, input.currency),
      memberPriceMinor,
      memberPriceFormatted:
        memberPriceMinor !== null ? formatPriceMinor(memberPriceMinor, input.currency) : null,
      memberLocked,
      comparatorEnabled: input.comparatorEnabled ?? false,
    },
  };
}
