import type { AeoBlock } from '@mch/seo';

interface ItineraryAeoBlockProps {
  readonly aeo: AeoBlock;
  readonly headingId?: string;
}

/**
 * Visible AEO block paired with the `FAQPage` JSON-LD on the
 * itinerary detail. The block carries:
 *
 *   - The question as a `sr-only` heading so screen readers and LLMs
 *     get the canonical wording without competing with the H1.
 *   - The validated 40–80-word answer verbatim — `buildAeoBlock`
 *     normalised the trim/whitespace so we can render `aeo.answer`
 *     directly.
 *
 * Built upstream by `buildAeoBlock` (see `@mch/seo/aeo`). The page
 * fails fast (throws) when validation fails — no fallback render
 * here, by design.
 *
 * Skill: geo-llm-optimization §AEO.
 */
export function ItineraryAeoBlock({ aeo, headingId = 'aeo-heading' }: ItineraryAeoBlockProps) {
  return (
    <section
      data-aeo="answer-block"
      aria-labelledby={headingId}
      className="bg-muted/5 border-border my-10 max-w-prose rounded-lg border p-5 md:p-6"
    >
      <h2 id={headingId} className="sr-only">
        {aeo.question}
      </h2>
      <p className="text-fg/90 text-base leading-relaxed md:text-lg">{aeo.answer}</p>
    </section>
  );
}
