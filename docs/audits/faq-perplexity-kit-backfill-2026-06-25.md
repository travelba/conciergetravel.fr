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

| Checkpoint                  | Published | With kit | % covered |
| --------------------------- | --------- | -------- | --------- |
| Baseline (audit)            | 2985      | 8        | 0.27 %    |
| After waves 1–2 (1 worker)  | 2985      | 195      | 6.5 %     |
| After 4-shard wave (HALTED) | 2985      | 428      | 14.3 %    |
| PO STOP — DataForSEO pivot  | 2985      | 438      | 14.7 %    |
| Grounded resume (shard 0)   | 2985      | —        | (running) |

## ▶ GROUNDED resume (2026-06-25 ~21:12) — shard 0, concurrency 3

Pipeline now DataForSEO-grounded (commit `77d33bce`): each fiche injects real
PAA/keywords and logs `grounding=on dfs_paa_coverage=<pct>`. Grounded wave log:

| Wave      | Segment | Enriched | Grounded | avg PAA cov | Perplexity $ | Notes                                                  |
| --------- | ------- | -------- | -------- | ----------- | ------------ | ------------------------------------------------------ |
| g-nn-1    | netnew  | 52/60    | 44       | 42 %        | 7.88         | 9 grounding=off (no DFS cache), 0 quota                |
| g-nn-2    | netnew  | 0/1      | 0        | —           | 0.25         | netnew drained; `seda-club` stuck on promote.canonical |
| g-heads-1 | heads   | 59/60    | 58       | 57 %        | 6.83         | 98 % grounded, 0 quota                                 |
| g-heads-2 | heads   | 137/150  | 130      | 51 %        | 19.18        | 0 quota, 13 gate-deferred                              |
| g-heads-3 | heads   | 138/150  | 140      | 55 %        | 18.40        | 0 quota                                                |

`grounding=off` rate ≈ 15 % (hotels with no DataForSEO cache) — non-blocking
per PO, flagged for a later DFS cache backfill on those slugs.

## ⏸ STOP — pipeline pivot to DataForSEO grounding (2026-06-25 ~20:52)

PO directive: **all content creation must be anchored + verified by DataForSEO
(PAA / intent / volume)**. The current FAQ pipeline does not ground on
DataForSEO, so the chantier is paused after the quota resume. Shard 0 stopped
its runner mid-wave (no new fiche started — concurrency-3 in-flight ≤3 were
interrupted, idempotent → will be regenerated with grounding). A dedicated
worker will add DataForSEO grounding to the FAQ generator before relaunch.

**Counter at stop — `shard0: 119/747`** (PO ref 746; actual partition 747).
Global **438/2985** with kit. Resume (post-grounding) reuses the same
collision-free flags: `--shard=0 --shards=4 --segment=netnew|heads|rest
--concurrency=3`.

## Wave log

| Wave         | Segment | Enriched | Perplexity $ | EN $  | Total $ | Cumulative $ |
| ------------ | ------- | -------- | ------------ | ----- | ------- | ------------ |
| smoke        | 1898    | 1        | 0.19         | 0.004 | 0.19    | 0.19         |
| 1            | netnew  | 40/40    | 4.11         | 0.17  | 4.28    | 4.47         |
| 2            | netnew  | 146/150  | 18.72        | 0.63  | 19.35   | 23.82        |
| s0-1 (4-way) | netnew  | 52/134   | 6.68         | 0.23  | 6.91    | 30.73¹       |

¹ Shard-0 spend only. Shards 1-3 ran in parallel and spent comparably — the
combined 4-worker burst lifted the catalogue 195 → **428 with kit** before the
shared Perplexity key hit its billing quota.

## ⛔ HALT — Perplexity quota exhausted (2026-06-25 ~20:55)

The 4 parallel shards drained the shared Perplexity credit. Shard-0 wave s0-1
enriched 52/134 then every remaining FR call returned **HTTP 401 "You exceeded
your current quota, please check your plan and billing details"** (fails in
0.3 s, `pplx=$0`). This is the hard stop condition (quota épuisé), not a
transient 429 — the runner did not hang, it logged each 401 and exited cleanly.
Deferred this wave: ~28 `kit.en_parity` row-gate (retriable) + ~54 quota-401.

**Resume once the Perplexity plan is topped up** (idempotent — re-skips the 428
already done; `--shard`/`--shards` keep the 4 workers collision-free):

```bash
# Shard 0 of 4 (workers 1..3 use --shard=1|2|3) — netnew first, then heads, then rest
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --shard=0 --shards=4 --segment=netnew --limit=150 --concurrency=5
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --shard=0 --shards=4 --segment=heads  --limit=150 --concurrency=5
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --shard=0 --shards=4 --segment=rest   --limit=150 --concurrency=5
# single worker fallback (no parallelism)
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --segment=netnew --limit=150 --concurrency=4
```

Residual: 2557 published fiches still without kit (incl. 344 net-new). Lower
total concurrency (4 shards × 5 = 20 simultaneous Perplexity calls) burns the
quota fast — consider concurrency=3/shard on resume to smooth spend.

## ▶ RESUME — grounded pipeline (DataForSEO PAA) — shard 3 log

Pipeline now grounds on DataForSEO (commit `77d33bce`): real PAA/intent injected
into the Perplexity prompt, per-fiche `grounding=on dfs_paa_coverage=<pct>`
logged, non-blocking. Shard 3 relaunched `--grounded --concurrency=3`.

| Wave (shard 3) | Segment | Enriched | grounded | avg PAA cov | Perplexity $ | EN $ | Cumulative $ |
| -------------- | ------- | -------- | -------- | ----------- | ------------ | ---- | ------------ |
| g1             | netnew  | 54/60    | 51       | 58 %        | 7.91         | 0.24 | 8.15         |
| g2             | netnew  | 42/43    | 40       | 54 %        | 5.92         | 0.18 | 14.25        |
| g3             | heads   | 58/60    | 58       | 53 %        | 7.00         | 0.25 | 21.50        |
| g4             | heads   | 57/60    | 55       | 59 %        | 7.09         | 0.25 | 28.83        |
| g5             | heads   | 57/60    | 55       | 49 %        | 7.26         | 0.25 | 36.34        |
| g6             | heads   | 58/60    | 59       | 47 %        | 7.32         | 0.26 | 43.92        |
| g7             | heads   | 57/60    | 57       | 51 %        | 6.80         | 0.25 | 50.97        |

`grounding=on` confirmed at wave + per-fiche level; only 2 `grounding=off`
(DFS returned no PAA for that slug — degrade-safe, non-blocking). Low-coverage
warnings (<50 %) are dominated by off-topic PAA (celebrity / generic-price
questions) not legitimately FAQ-able for the property. 6 skips this wave
(`kit.en_parity` + `promote.canonical`) — idempotent, retried next run.

**Shard-3 counter: `shard3: 469/746`** (100 → 154 → 182 → 240 → 298 → 354 →
412 → 469; netnew exhausted, grinding `heads`). Prod acceptance after g4:
`mama-shelter-lille` 200, `FAQPage` JSON-LD + `acceptedAnswer` rendered,
concierge block present, no `Offer` leak (Phase 6 respected). Resume continues
`--segment=heads` then `--segment=rest`, all
`--shard=3 --shards=4 --grounded --concurrency=3`.
