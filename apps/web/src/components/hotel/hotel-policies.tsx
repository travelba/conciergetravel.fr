import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedPolicies, PaymentMethod } from '@/server/hotels/get-hotel-by-slug';

interface HotelPoliciesProps {
  readonly locale: SupportedLocale;
  readonly policies: LocalisedPolicies;
}

const PAYMENT_METHOD_ORDER: readonly PaymentMethod[] = [
  'visa',
  'mc',
  'amex',
  'diners',
  'jcb',
  'unionpay',
  'apple_pay',
  'google_pay',
  'cash',
  'bank_transfer',
];

function sortMethods(methods: readonly PaymentMethod[]): readonly PaymentMethod[] {
  return [...methods].sort(
    (a, b) => PAYMENT_METHOD_ORDER.indexOf(a) - PAYMENT_METHOD_ORDER.indexOf(b),
  );
}

/**
 * Policies section for the hotel detail page — CDC §2 bloc 14.
 *
 * Renders only the populated branches of the localized policy snapshot:
 * `<dl>` of facts (check-in/out, free-until cancellation, pet fee, child
 * age limit, deposit) + per-branch notes when present.
 *
 * Pure RSC. Caller decides whether to render the section
 * (typically: only when `hasAnyPolicy(policies)` is true).
 *
 * Each sub-block has an opinionated, sober layout meant to remain
 * scannable on mobile (avoids dense paragraphs) — aligned with the
 * accessibility skill (no expand/collapse, no client JS).
 */
export async function HotelPolicies({
  locale,
  policies,
}: HotelPoliciesProps): Promise<React.ReactElement | null> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  return (
    <section aria-labelledby="policies-title" className="mb-12">
      {/*
        Progressive disclosure (2026-06-01): collapsed by default to keep the
        fiche scannable. Native <details> → zero client JS, keyboard-operable
        (a11y skill), and the policy facts stay in the DOM so Google still
        indexes them when folded. The <h2> lives inside <summary> to preserve
        the heading outline. GEO-critical facts (check-in, pets, taxes) are
        also surfaced in the factual summary + FAQ, which stay open.
      */}
      <details className="group">
        <summary className="flex cursor-pointer select-none list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            className="text-muted shrink-0 transition-transform group-open:rotate-90"
          >
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h2 id="policies-title" className="text-fg font-serif text-2xl">
            {t('sections.policies')}
          </h2>
        </summary>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {policies.checkIn !== null || policies.checkOut !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.checkInOut} />
                <span>{t('policies.checkInOutTitle')}</span>
              </h3>
              <dl className="text-fg flex flex-col gap-1 text-sm">
                {policies.checkIn !== null ? (
                  <div>
                    <dt className="text-muted">{t('policies.checkInLabel')}</dt>
                    <dd>
                      {policies.checkIn.until !== null
                        ? t('policies.checkInRange', {
                            from: policies.checkIn.from,
                            until: policies.checkIn.until,
                          })
                        : t('policies.checkInFrom', { from: policies.checkIn.from })}
                    </dd>
                  </div>
                ) : null}
                {policies.checkOut !== null ? (
                  <div>
                    <dt className="text-muted">{t('policies.checkOutLabel')}</dt>
                    <dd>{t('policies.checkOutUntil', { until: policies.checkOut.until })}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ) : null}

          {policies.cancellation !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.cancellation} />
                <span>{t('policies.cancellationTitle')}</span>
              </h3>
              {policies.cancellation.summary !== null ? (
                <p className="text-fg text-sm">{policies.cancellation.summary}</p>
              ) : null}
              {policies.cancellation.freeUntilHours !== null ? (
                <p className="text-muted mt-2 text-sm">
                  {t('policies.cancellationFreeUntil', {
                    count: policies.cancellation.freeUntilHours,
                  })}
                </p>
              ) : null}
              {policies.cancellation.penaltyAfter !== null ? (
                <p className="text-muted mt-2 text-sm">{policies.cancellation.penaltyAfter}</p>
              ) : null}
            </article>
          ) : null}

          {policies.pets !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.pets} />
                <span>{t('policies.petsTitle')}</span>
              </h3>
              <p className="text-fg text-sm">
                {policies.pets.allowed
                  ? policies.pets.feeEur !== null && policies.pets.feeEur > 0
                    ? t('policies.petsAllowedFee', { amount: policies.pets.feeEur })
                    : t('policies.petsAllowedFree')
                  : t('policies.petsNotAllowed')}
              </p>
              {policies.pets.notes !== null ? (
                <p className="text-muted mt-2 text-sm">{policies.pets.notes}</p>
              ) : null}
            </article>
          ) : null}

          {policies.children !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.children} />
                <span>{t('policies.childrenTitle')}</span>
              </h3>
              <p className="text-fg text-sm">
                {policies.children.welcome
                  ? t('policies.childrenWelcome')
                  : t('policies.childrenNotWelcome')}
              </p>
              {policies.children.freeUnderAge !== null ? (
                <p className="text-muted mt-2 text-sm">
                  {t('policies.childrenFreeUnder', { age: policies.children.freeUnderAge })}
                </p>
              ) : null}
              {policies.children.extraBedFeeEur !== null ? (
                <p className="text-muted mt-1 text-sm">
                  {t('policies.childrenExtraBed', { amount: policies.children.extraBedFeeEur })}
                </p>
              ) : null}
              {policies.children.notes !== null ? (
                <p className="text-muted mt-2 text-sm">{policies.children.notes}</p>
              ) : null}
            </article>
          ) : null}

          {policies.payment !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4 md:col-span-2">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.payment} />
                <span>{t('policies.paymentTitle')}</span>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {sortMethods(policies.payment.methods).map((m) => (
                  <li
                    key={m}
                    className="border-border bg-bg text-fg rounded-md border px-2 py-0.5 text-xs"
                  >
                    {t(`policies.paymentMethod.${m}`)}
                  </li>
                ))}
              </ul>
              {policies.payment.depositRequired !== null ? (
                <p className="text-muted mt-3 text-sm">
                  {policies.payment.depositRequired
                    ? t('policies.paymentDepositRequired')
                    : t('policies.paymentNoDeposit')}
                </p>
              ) : null}
              {policies.payment.notes !== null ? (
                <p className="text-muted mt-2 text-sm">{policies.payment.notes}</p>
              ) : null}
            </article>
          ) : null}

          {policies.cityTax !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.cityTax} />
                <span>{t('policies.cityTaxTitle')}</span>
              </h3>
              <p className="text-fg text-sm">
                {t('policies.cityTaxAmount', {
                  amount: policies.cityTax.amountPerPersonPerNight.toFixed(2),
                  currency: policies.cityTax.currency,
                })}
              </p>
              {policies.cityTax.freeUnderAge !== null ? (
                <p className="text-muted mt-2 text-sm">
                  {t('policies.cityTaxFreeUnder', { age: policies.cityTax.freeUnderAge })}
                </p>
              ) : null}
              {policies.cityTax.notes !== null ? (
                <p className="text-muted mt-2 text-sm">{policies.cityTax.notes}</p>
              ) : null}
            </article>
          ) : null}

          {policies.wifi !== null ? (
            <article className="border-border bg-bg rounded-lg border p-4">
              <h3 className="text-fg mb-2 flex items-center gap-2.5 font-medium">
                <PolicyMedallion icon={POLICY_ICONS.wifi} />
                <span>{t('policies.wifiTitle')}</span>
              </h3>
              <p className="text-fg text-sm">
                {policies.wifi.included
                  ? policies.wifi.scope !== null
                    ? t(`policies.wifiIncludedScope.${policies.wifi.scope}`)
                    : t('policies.wifiIncluded')
                  : t('policies.wifiNotIncluded')}
              </p>
              {policies.wifi.notes !== null ? (
                <p className="text-muted mt-2 text-sm">{policies.wifi.notes}</p>
              ) : null}
            </article>
          ) : null}
        </div>
      </details>
    </section>
  );
}

/**
 * Small amber medallion holding a per-policy glyph, aligned with the
 * neighbourhood / events visual language so every practical fact reads at
 * a glance. Decorative (`aria-hidden`) — the title text carries meaning.
 */
function PolicyMedallion({ icon }: { readonly icon: React.ReactNode }): React.ReactElement {
  return (
    <span
      aria-hidden
      className="border-accent/30 bg-accent/10 text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
    </span>
  );
}

/** One glyph per structured policy branch (fixed mapping, no resolver). */
const POLICY_ICONS = {
  // Clock — check-in / check-out times.
  checkInOut: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  // Shield + check — cancellation guarantee.
  cancellation: (
    <>
      <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Paw — pets.
  pets: (
    <>
      <circle cx="5.6" cy="12.6" r="1.5" />
      <circle cx="9.6" cy="8.6" r="1.5" />
      <circle cx="14.4" cy="8.6" r="1.5" />
      <circle cx="18.4" cy="12.6" r="1.5" />
      <path d="M12 13.2c-2.2 0-4 1.7-4 3.6 0 1.7 1.6 2.2 4 2.2s4-.5 4-2.2c0-1.9-1.8-3.6-4-3.6z" />
    </>
  ),
  // Child figure — children policy.
  children: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v6M9 21l3-7 3 7M8 11h8" />
    </>
  ),
  // Card — accepted payment methods.
  payment: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  // Receipt — city / tourist tax.
  cityTax: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  // Wi-Fi waves.
  wifi: (
    <>
      <path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" />
      <circle cx="12" cy="18.6" r="0.9" />
    </>
  ),
} satisfies Record<string, React.ReactNode>;
