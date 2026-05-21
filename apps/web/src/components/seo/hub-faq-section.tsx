import { headers } from 'next/headers';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';

/**
 * `<HubFaqSection>` — multi-Q FAQ block for hub pages.
 *
 * Renders the AEO-grade FAQ surface required by skill
 * `geo-llm-optimization` §FAQ extraction on every hub:
 *
 *   - 5-10 Q&A authored per page (50-100 words per answer for LLM
 *     citation density — denser than the AEO block's 40-80).
 *   - Visible as `<details>` elements; the first is `open` by default
 *     so the answer text is in the DOM at load (LLM crawlers
 *     sometimes skip closed `<details>` — see skill §FAQ extraction).
 *   - Companion `FAQPage` JSON-LD over the full Q&A set.
 *
 * Why a dedicated component (vs each hub inlining its own):
 *   - Uniform DOM shape across hubs — simplifies the AEO coverage
 *     regression test planned in Vague 7.
 *   - Guarantees the first item is rendered open by default.
 *   - Single point of truth for the `FAQPage` JSON-LD emission
 *     (avoids duplicate `FAQPage` blocks when a hub also surfaces an
 *     `<HubAeoSection>` — callers should pass `emitJsonLd={false}`
 *     on the AEO section when both are present, or rely on this
 *     component as the canonical FAQ surface).
 *
 * Designed as a Server Component — reads `headers()` for the CSP
 * nonce. Pages that include it must run under `force-dynamic`
 * (the existing JSON-LD contract on hubs already enforces it).
 */
export interface HubFaqItem {
  readonly question: string;
  readonly answer: string;
}

interface HubFaqSectionProps {
  readonly items: readonly HubFaqItem[];
  /** Localised heading rendered above the list. */
  readonly heading: string;
  /**
   * When `false`, suppresses the `FAQPage` JSON-LD emission. Useful
   * when the caller already emits the FAQ JSON-LD elsewhere (e.g.
   * the `/le-concierge` page emits it inline alongside the
   * TravelAgency JSON-LD).
   */
  readonly emitJsonLd?: boolean;
}

export async function HubFaqSection({
  items,
  heading,
  emitJsonLd = true,
}: HubFaqSectionProps): Promise<ReactElement | null> {
  if (items.length === 0) return null;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const faqJsonLd = emitJsonLd
    ? JsonLd.withSchemaOrgContext(
        JsonLd.faqPageJsonLd(items.map((it) => ({ question: it.question, answer: it.answer }))),
      )
    : null;

  return (
    <section aria-labelledby="hub-faq-title" className="mt-12">
      {faqJsonLd !== null ? <JsonLdScript data={faqJsonLd} nonce={nonce} /> : null}
      <h2 id="hub-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
        {heading}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((item, idx) => (
          <details
            key={item.question}
            open={idx === 0}
            className="border-border bg-bg group rounded-lg border p-4"
          >
            <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 font-serif text-base [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="h-4 w-4 opacity-60 transition group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="text-muted mt-2 text-sm md:text-base">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
