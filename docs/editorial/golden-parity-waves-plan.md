# Golden parity waves — runbook (A→C)

> Status: DRAFT (planning) — 2026-06-04
> Sister doc: `docs/editorial/deep-content-enrichment-plan.md` (sections content)
> and ADR `docs/adr/0029-deep-content-enrichment-anti-scaffolding.md` (invariants).

## 0. Why this plan

The catalogue-wide CDC audit (`scripts/editorial-pilot/runs/hotel-fiche-cdc-summary-2026-06-04.txt`,
2219 published fiches) shows the editorial/structure/SEO/agentique skills are now
generalised, but three golden-template dimensions still lag:

| Dimension                         | Mean score | Lever                                |
| --------------------------------- | ---------: | ------------------------------------ |
| SEO / Agentique / Restructuration |    99-100% | ✅ done (prior waves)                |
| GEO / JSON-LD / T3 / FAQ          |     75-84% | partial                              |
| Maillage / EEAT                   |        63% | POI + internal links                 |
| **Golden template (handoff)**     |     **5%** | **concierge dossiers resto/spa/POI** |

> ⚠️ Audit caveat: the 2026-06-04 run used the PostgREST path (direct PG host
> unreachable from the dev box), so **room stats were not counted** — block `05`
> and `hotel_rooms` gaps are artifacts, ignore them. Re-run via the pooler
> (`MCH_AUDIT_FORCE_REST` unset, pooler URL reachable) for a 100%-clean board.

## 1. Invariants (inherited from ADR-0029)

Every wave MUST keep:

- **I1 anti-leak** — no scaffolding marker survives (`scaffolding-gate.ts`).
- **I2 EEAT** — only sourced facts; if < 2 anchored facts, leave the field
  empty/absent (honest), never invent. Empty string is forbidden in section/FAQ
  fields (`z.string().min(1)` — see `repair-empty-section-fields.ts` lesson).
- **I3 deep Tavily** — targeted queries + advanced extract, OTA domains excluded.
- **I4 per-field idempotence** — only write missing fields; never overwrite good
  existing content; safe to re-run.
- **I5 bilingual discipline** — never persist `body_en/title_en/answer_en = ""`;
  drop the key until the EN pass fills it.

## 2. Wave C — FAQ golden (recommended FIRST: highest confidence, big AEO win)

**Gap**: `faq` 75%; `cdc.11.faq_canonical`, `faq_featured`, `faq_tips`,
`faq_answer_band`, `faq_en_parity` failing; `jsonld.faqpage` prerequisite blocked
catalogue-wide.

**Target (gates)**:

- `faq_content` length in CDC band (10–15 items) — `extend-faq-to-10.ts`.
- 10 canonical questions present — `run-faq-canonical.ts` + `canonical-faq-questions.ts`.
- exactly 5 `featured` items with `concierge_tip_fr` — `run-humanizer-faq.ts`.
- answers in word band (GEO citation density); EN parity (`answer_en`).

**Pipeline (existing)**:

```powershell
# dry first, then live; idempotent
npx tsx src/hotels/run-faq-canonical.ts --dry-run --limit=5
npx tsx src/hotels/run-faq-canonical.ts            # 10 canonical Q/A
npx tsx src/enrichment/extend-faq-to-10.ts         # top up to band
pnpm run concierge:humanize:faq                    # 5 featured + tips + voice
```

**Acceptance**: re-audit → `faq` ≥ 95%, `jsonld.faqpage` passing on all published.

## 3. Wave B — POI « à deux pas » + maillage

**Gap**: `maille` 63%; `points_of_interest` missing on 2305; `gold.poi_buckets`

- `gold.poi_handoff` failing.

**Target (gates)**:

- ≥ N POIs with distance (`cdc.07` / `POIS_MIN_COUNT`).
- buckets visit/do/shop all covered (`gold.poi_buckets`).
- ≥ `GOLDEN_POI_HANDOFF_MIN` POIs with full handoff (contact/hours/tip).
- POI descriptions + concierge bucket tips.

**Pipeline (existing)**:

```powershell
pnpm run pois:sync:dry                  # OSM/Overpass preview, no LLM
pnpm run pois:sync                       # sync POIs (free OSM) + merge
npx tsx src/pois/llm-describe-pois.ts    # 1-2 sentence EEAT descriptions
pnpm run concierge:humanize:pois         # concierge bucket tips + handoff
```

**Note**: OSM Overpass is free but rate-limited → expect a long, mostly-idle run.
Also lifts `maille.signature_experiences` indirectly via internal-link mesh.

## 4. Wave A — Concierge handoff resto/spa (biggest single golden lever)

**Gap**: `golden` 5%; `gold.venues_handoff`, `gold.venues_all_handoff`,
`gold.spa_dossier` failing catalogue-wide.

**Target (gates)** — fields on `restaurant_info.venues[]` and `spa_info`:

- venue: `phone`/`address` + `must_order_fr` + `tip_fr` (+ hours, price_note).
- spa: `description_fr` + `hours_fr` + contact + `tip_fr`.

**Tooling**: extractors exist (`dining-extractor.ts`, `wellness-extractor.ts`)
but there is **no writer/orchestrator** that lands the handoff fields into
`restaurant_info` / `spa_info`. → **NEW script** `enrich-concierge-handoff.ts`
(mirror `enrich-residual-sections.ts`: gap-detect → Tavily extract → EEAT gate →
per-field write → idempotent).

**Sequence**:

```powershell
# 1. source venues/spa if missing (dining/wellness extractors via brief-builder)
# 2. write handoff fields with EEAT gate (NEW enrich-concierge-handoff.ts)
npx tsx src/enrichment/enrich-concierge-handoff.ts --dryRun --limit=12
npx tsx src/enrichment/enrich-concierge-handoff.ts --auto --concurrency=6
```

**Reality check**: venue phone/address/booking data is often NOT findable for
non-flagship hotels → EEAT gate will leave many incomplete (honest). Expect a
realistic 40–60% fill, highest on palaces/5★.

## 5. Recommended order & rationale

1. **C (FAQ)** — fully tooled, highest confidence, unblocks FAQPage JSON-LD
   (a `blocker`-severity prerequisite) catalogue-wide.
2. **B (POI)** — free OSM data, lifts maille + GEO, tooled end-to-end.
3. **A (handoff)** — biggest golden lever but needs a new writer + has the
   lowest fill certainty; do last so the audit board is already green elsewhere.

Bonus quick win (independent): `pnpm run enrich:amenities` closes the block-06
`amenities` gap (2219) cheaply.

## 6. Cost & duration estimates (rough, ~2200 published fiches)

| Wave          |     LLM cost |        Tavily | External         | Duration (bg, conc. 6)   | Confidence           |
| ------------- | -----------: | ------------: | ---------------- | ------------------------ | -------------------- |
| C FAQ         |      ~$30–60 |        ~0–500 | —                | ~3–6 h                   | high                 |
| B POI         |      ~$20–40 |            ~0 | OSM (free, slow) | ~4–10 h (rate-limited)   | high                 |
| A handoff     |      ~$15–30 | ~5–9k credits | —                | ~2–4 h                   | medium (40–60% fill) |
| amenities     |       ~$5–10 |         small | —                | ~1–2 h                   | high                 |
| **Total A→C** | **~$65–130** |     **~5–9k** | —                | **~1–2 days unattended** | —                    |

Assumptions: gpt-5.4 flagship, retries, single-concern calls; costs scale with
fill rate (skips are cheap). Tavily heavy only on Wave A (per-venue extraction).

## 7. Acceptance & re-audit (per wave)

After each wave:

```powershell
$env:MCH_AUDIT_FORCE_REST='1'
npx tsx src/hotels/audit-hotel-fiche-cdc.ts --published-only --format=both
```

Then a `user-acceptance-loop` walk on 3 fiches (1 palace, 1 5★, 1 international)
confirming the new block renders FR + EN. Target deltas: C → `faq` ≥ 95%;
B → `maille` ≥ 80%, POI buckets covered; A → `golden` ≥ 40% (fill-limited).

## 8. Risks

- **Hallucinated contact data** (phone/address) → I2 gate + source quote required;
  reject if no `evidenceQuote` + `sourceUrl`.
- **OSM rate limits** stalling Wave B → throttle, resumable, idempotent.
- **EN parity debt** — all waves must schedule the EN pass or drop EN keys (I5);
  never persist `""`.
- **Cost overrun on Wave A Tavily** → cap scan budget, skip-no-facts early.
