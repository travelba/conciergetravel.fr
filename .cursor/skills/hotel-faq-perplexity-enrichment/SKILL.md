---
name: hotel-faq-perplexity-enrichment
description: Perplexity-driven exhaustive hotel FAQ research for MyConciergeHotel.com — mandatory on every published hotel fiche (2219+ catalogue + all future fiches). 40–60 factual Q&A + 20–30 concierge-voice questions, two-tier promote/kit model, MCP workflow, validate/push CLI, and publish gates. Use when generating, validating, pushing, or backfilling hotel FAQ content via Perplexity.
---

# Hotel FAQ — Perplexity enrichment — MyConciergeHotel.com

**Policy (what):** [`.cursor/rules/hotel-faq-perplexity.mdc`](../../rules/hotel-faq-perplexity.mdc) — kit Perplexity obligatoire sur **toutes** les fiches, sans exception.

**This skill (how):** prompt MCP, taxonomy, CLI, gates, rendu web.

Two-tier FAQ model — **every** hotel fiche:

| Layer         | Column                | Volume         | Tone                  | Consumer                                           |
| ------------- | --------------------- | -------------- | --------------------- | -------------------------------------------------- |
| **Kit**       | `faq_content_kit`     | 40–60 (max 80) | Factuel, fiche info   | DOM `<HotelFaq>` grouped by `group_fr`             |
| **Promote**   | `faq_content`         | 10–15          | Factuel               | JSON-LD `FAQPage` + publish gates + Top 5 featured |
| **Concierge** | `concierge_questions` | 20–30          | Voix « Je », proactif | Bloc `#concierge-questions`                        |

Golden reference: `DA/_generated/airelles-faq-data.json` (77 kit + 15 promote + 28 concierge).

## Triggers

Invoke when:

- Running Perplexity research for **any** hotel fiche (Cursor MCP `user-perplexity`).
- Backfilling the **2219+ published catalogue** (wave batches via `--slug` or future `--all-published`).
- Validating / pushing `out/faq-perplexity/<slug>.json`.
- Adding or debugging CDC audit checks `cdc.11.faq_kit_count` / `cdc.11.concierge_questions_count`.
- Wiring render (`readFaqDisplayGroups`, `HotelConciergeQuestions`) or publish gates.

## Rule 1 — Perplexity prompt (canonical template)

Prompt file: [`scripts/editorial-pilot/prompts/12-hotel-faq-perplexity-research.md`](../../scripts/editorial-pilot/prompts/12-hotel-faq-perplexity-research.md)

Replace `{{HOTEL_NAME}}`, `{{CITY}}`, `{{COUNTRY}}`, `{{SLUG}}`.

**MCP workflow (Cursor):**

1. Read prompt template.
2. Call `user-perplexity` → `perplexity_research` with the filled prompt (recency filter when facts may have changed).
3. Save raw JSON to `scripts/editorial-pilot/out/faq-perplexity/<slug>.json`.
4. Run validate → push (below).

**Sources to cross-validate:** site officiel, TripAdvisor, Booking.com, Expedia, Hotels.com, Michelin Guide, presse luxe, blogs voyage, Google reviews.

**Anti-hallucination:** chiffre ou horaire non confirmé par ≥ 2 sources → « Contactez la conciergerie pour confirmer les modalités du jour. »

## Rule 2 — Category taxonomy (exact French labels)

Factual categories (12) → CDC intent bucket via `FAQ_CATEGORY_TO_BUCKET`:

| Catégorie FR                           | Bucket   |
| -------------------------------------- | -------- |
| Arrivée & Départ, Localisation & Accès | `before` |
| Chambres … Accessibilité               | `during` |
| Facturation & Politiques, Durabilité   | `agency` |

Concierge categories (8): Transferts & Transport, Réservations de restaurants, Réservations spa, Excursions & Visites culturelles, Occasions spéciales, Shopping & Services de luxe, Activités familiales, Expériences personnalisées.

Source of truth: [`faq-perplexity-taxonomy.ts`](../../scripts/editorial-pilot/src/hotels/faq-perplexity-taxonomy.ts).

## Rule 3 — Two-tier storage (do not collapse)

```
Perplexity JSON
  ├── faq[]              → faq_content_kit (full kit, 40–60)
  │     └── promote 10–15 → faq_content (JSON-LD + gates)
  └── concierge_questions[] → concierge_questions
```

**Never** store 40–60 items only in `faq_content` — CDC gate `cdc.11.faq_count` caps at 15 and publish eligibility breaks.

JSON-LD uses `pickHotelJsonLdFaqEntries` on **promote** items only (`HOTEL_JSON_LD_FAQ_MAX = 20`). Full kit stays in HTML for GEO.

## Rule 4 — CLI pipeline

```bash
# 1. Validate schema + coverage gates
pnpm --filter @mch/editorial-pilot faq:perplexity:validate -- \
  --input=out/faq-perplexity/le-bristol-paris.json \
  --hotel-name="Le Bristol Paris"

# 2. Push to Supabase (requires migration 0075)
pnpm --filter @mch/editorial-pilot faq:perplexity:push -- \
  --slug=le-bristol-paris \
  --input=out/faq-perplexity/le-bristol-paris.json

# 3. Humanizer Top 5 featured (optional post-push)
pnpm --filter @mch/editorial-pilot concierge:humanize:faq -- --slug=le-bristol-paris
```

## Rule 5 — Catalogue remediation (2219+ fiches)

Existing published fiches without kit data **fail** `evaluatePublishGate()` and CDC checks once gates are enforced.

Remediation order:

1. Apply migration `0075_hotels_faq_kit_concierge_questions.sql`.
2. Run Perplexity per slug (or batch runner when available) → validate → push.
3. Re-run `audit-hotel-fiche.ts` on the wave; fix category gaps before next wave.

Prioritise high-traffic fiches (Palaces Paris, Relais & Châteaux flagship) if token budget is limited — but **no fiche is exempt** from the policy.

## Rule 6 — Web rendering

| Reader                          | Column                               | Used by                     |
| ------------------------------- | ------------------------------------ | --------------------------- |
| `readFaqDisplayGroups()`        | `faq_content_kit` (fallback promote) | `<HotelFaq displayGroups>`  |
| `readFaqPromote()`              | `faq_content`                        | JSON-LD `FAQPage`           |
| `readConciergeQuestionGroups()` | `concierge_questions`                | `<HotelConciergeQuestions>` |

Components: `apps/web/src/components/hotel/hotel-faq.tsx`, `hotel-concierge-questions.tsx`.

## Anti-patterns

| Anti-pattern                         | Why it fails                                              | Correct path                                          |
| ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| « Fiche standard = 10 FAQ LLM only » | Policy catalogue entier — rule `hotel-faq-perplexity.mdc` | Perplexity kit + concierge on every fiche             |
| 60 items in `faq_content` only       | Breaks max-15 gate + JSON-LD cap                          | Split kit / promote via `faq-perplexity-transform.ts` |
| Concierge block Airelles-only        | Bloc `#concierge-questions` on all fiches with data       | `readConciergeQuestionGroups()` in standard page      |
| Skip validate before push            | Zod + coverage gates catch canonical gaps                 | Always `faq:perplexity:validate` first                |

## References

- Rule: [`.cursor/rules/hotel-faq-perplexity.mdc`](../../rules/hotel-faq-perplexity.mdc)
- CDC bloc 11: [`.cursor/rules/hotel-detail-page.mdc`](../../rules/hotel-detail-page.mdc)
- [`geo-llm-optimization`](../geo-llm-optimization/SKILL.md) — FAQ extraction / GEO
- [`content-enrichment-pipeline`](../content-enrichment-pipeline/SKILL.md) — cross-source validation
- [`concierge-voice-pipeline`](../concierge-voice-pipeline/SKILL.md) — voix « Je » Top 5
