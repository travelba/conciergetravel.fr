# FAQ Perplexity kit — catalogue-wide backfill (2026-06-25)

> Closes the gap surfaced by `hotel-fiches-template-audit-2026-06-25.md` §2.2:
> only **8 / 2985** published fiches carried the two-tier Perplexity FAQ kit
> (hard rule CDC §2.11). This chantier backfills `faq_content_kit` (48–60),
> `faq_content` promote (15, 10 CDC canonical) and `concierge_questions`
> (24–28) across the published catalogue, FR + EN, web-grounded.

## Tooling

- Runner: `scripts/editorial-pilot/src/hotels/run-faq-perplexity-batch.ts`
  (`pnpm --filter @mch/editorial-pilot faq:perplexity:batch`).
- FR via Perplexity API `sonar-pro` (JSON-schema structured output, web-grounded);
  EN via `gpt-4o-mini` (faithful, informative tone); gates =
  `evaluateFaqKitCoverage` + `evaluateFaqKitRowEnrichment` + shared `hasLeak()`.
- Idempotent: candidate query excludes fiches with a non-null `faq_content_kit`.
- Timeouts on every call (`withTimeout`, Rule 20); per-fiche `Promise.allSettled`.
- Cost from the Perplexity API `usage.cost` + gpt-4o-mini estimate; per-wave
  runlog in `runs/faq-perplexity/` (gitignored).

## Priority order (PO)

1. **764 net-new** (`is_published ∧ priority=P2 ∧ booking_mode=display_only ∧ created_at=2026-06-25`).
2. **Acquisition heads** — hotels in published rankings (1975) + palaces (27).
3. **Rest** of the published catalogue by waves.

## Coverage

| Checkpoint       | Published | With kit | % covered |
| ---------------- | --------- | -------- | --------- |
| Baseline (audit) | 2985      | 8        | 0.27 %    |
| After waves 1–2  | 2985      | 195      | 6.5 %     |

## Wave log

| Wave  | Segment       | Enriched | Perplexity $ | EN $  | Total $ | Cumulative $ |
| ----- | ------------- | -------- | ------------ | ----- | ------- | ------------ |
| smoke | 1898-the-post | 1        | 0.19         | 0.004 | 0.19    | 0.19         |
| 1     | netnew        | 40/40    | 4.11         | 0.17  | 4.28    | 4.47         |
| 2     | netnew        | 146/150  | 18.72        | 0.63  | 19.35   | 23.82        |

Wave-2 deferred (4): 3× `kit.en_parity` row-gate, 1× `promote.canonical`
(`eden-lodge`) — kept null kit, auto-retried next wave (idempotent). Avg cost
≈ $0.127/fiche. Acceptance (prod, wave-1 fiche `ashford-castle`): FR + EN both
render **16 `Question` + `FAQPage`**, 0 content leak (the single FR "dossier"
hit is the allow-listed "dossier **de presse**" loyalty link).

## Resume command

```bash
# continue net-new, then heads, then rest
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --segment=netnew --limit=150 --concurrency=4
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --segment=heads  --limit=150 --concurrency=4
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --segment=rest   --limit=150 --concurrency=4
```
