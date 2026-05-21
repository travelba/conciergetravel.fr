import { headers } from 'next/headers';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';

/**
 * `<HubAeoSection>` — single-Q AEO block for hub pages.
 *
 * Renders the canonical AEO surface:
 *   - Visible `<section data-aeo>` with `<h2>` (question) + `<p>`
 *     (40-80 word answer) at the top of the page (skill
 *     `geo-llm-optimization` §AEO block).
 *   - Companion `FAQPage` JSON-LD with the same Q&A so AI Overviews
 *     and Perplexity can quote the answer with a structured-data
 *     anchor.
 *
 * Why a dedicated component (vs inlining as the home / destination
 * pages currently do):
 *   - Guarantees the `data-aeo` attribute, the nonce propagation and
 *     the `aria-labelledby` contract stay consistent across hubs.
 *   - Lets us add automated checks (`[data-aeo]` count, exactly one
 *     `FAQPage` per page) in CI without grepping each route file.
 *   - Centralises the freshness signal — the answer string should
 *     include a "Mise à jour <date>" cue per skill GEO §AEO; the
 *     component leaves that to the caller because freshness sourcing
 *     varies (DB `updatedAt`, build time, static editorial date).
 *
 * Designed as a Server Component — reads `headers()` for the CSP
 * nonce. Pages that include it implicitly inherit the
 * `force-dynamic` constraint already enforced for JSON-LD pages.
 */
interface HubAeoSectionProps {
  readonly question: string;
  readonly answer: string;
  /**
   * Optional `id` for the heading — used when the page already has
   * an `aeo-title` heading elsewhere and the component must use a
   * distinct anchor. Defaults to `"aeo-title"`.
   */
  readonly headingId?: string;
  /**
   * When `false`, suppresses the single-Q `FAQPage` JSON-LD emission.
   * Required by ADR-0011 C1 ("exactly one FAQPage per page") when the
   * caller also renders a `<HubFaqSection>` (or any other inline
   * `FAQPage` such as the `<HotelFaq>` block on `/le-concierge`).
   * Google merges multiple FAQPage blocks inconsistently — we keep
   * the canonical multi-Q FAQ JSON-LD as the source of truth and
   * surface the AEO answer as visible-only DOM content. The
   * `<section data-aeo>` is always emitted regardless.
   */
  readonly emitJsonLd?: boolean;
}

export async function HubAeoSection({
  question,
  answer,
  headingId = 'aeo-title',
  emitJsonLd = true,
}: HubAeoSectionProps): Promise<ReactElement> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const faqJsonLd = emitJsonLd
    ? JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd([{ question, answer }]))
    : null;

  return (
    <>
      {faqJsonLd !== null ? <JsonLdScript data={faqJsonLd} nonce={nonce} /> : null}
      <section
        data-aeo
        aria-labelledby={headingId}
        className="border-border bg-bg mb-10 rounded-lg border p-5"
      >
        <h2 id={headingId} className="text-fg font-serif text-lg">
          {question}
        </h2>
        <p className="text-muted mt-2 text-sm">{answer}</p>
      </section>
    </>
  );
}
