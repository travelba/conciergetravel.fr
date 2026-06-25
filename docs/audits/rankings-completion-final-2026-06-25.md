# Rankings completion — final synthesis (Phase E, 2026-06-25)

> Closes the plan **« Classements complets vs yonder.fr »** (Phases A→E).
> Phase E = refresh snapshot + regenerate rankings + re-audit completeness.
> Predecessors: A (audit), B (internal maillage), C (combinator hardening +
> completeness gate), D (764-hotel onboarding). This is the last link.

## 1. Snapshot refresh (E1)

- `out/hotels-catalog.json` regenerated via `export-hotels-catalog-rest.ts`.
- **Catalog: 2 985 hotels** (vs ~2 219 at the prior snapshot) — the 764
  Phase-D net-new are in, with `luxury_tier` / `affiliations` and the 7
  corrected regions (Phase C3).
- Matrix now resolves **3 880 seeds** (manual 129, auto 3 751).
- **`is_palace` cleanup**: reconciled against the 33 official Atout France
  palaces. The PostgREST PATCH path silently no-op'd under RLS (returned
  200/204 but changed 0 rows); re-applied via privileged `execute_sql`
  (MCP `plugin-supabase-supabase`) → **34 spurious flags removed, count
  settled at 33**. Lesson: a service-role JWT without `BYPASSRLS` can report
  a successful PATCH while RLS filters every row — verify the row count, not
  the HTTP status.

## 2. Regeneration (E2) — 3 waves

| Wave                         | Target                                                                              |   Pushed | Notes                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------- | -------: | ------------------------------------------------------- |
| 1 — 43 underfilled (C2 list) | regenerate `--force --strict`                                                       |       43 | all filled to target by the enlarged catalog            |
| 2 — international net-new    | high-volume seeds (eligibility ≥ 25): USA, Italy, China, Yonder cities              |      110 | net-new published rankings                              |
| 3 — re-fillable underfilled  | the 116 that became underfilled once the bigger catalog raised their `targetLength` | 99 / 100 | 1 refused by `--strict` (`centre-val-de-loire`, 9 < 10) |

- **OpenAI quota** (flagged exhausted in the handoff) had refreshed —
  confirmed via a single-slug `--force --no-push` probe before committing to
  the waves.
- **Push path**: direct `pg` connect fails on this box
  (`getaddrinfo ENOTFOUND db.<ref>.supabase.co`, IPv6-only host). Set
  `MCH_PUSH_VIA_REST=1` to route `push-ranking-v2.ts` through its PostgREST
  fallback — all 252 pushes succeeded that way.
- `justification_fr/_en` clamped ≤ 1200 chars (DB CHECK) by the runner.

### Published rankings before → after

| Metric                            | Before E (≤ 2026-06-24) | After E (2026-06-25) |             Δ |
| --------------------------------- | ----------------------: | -------------------: | ------------: |
| Published rankings                |                 **704** |              **814** |      **+110** |
| Touched this session (gen + push) |                       — |                  252 | 43 + 110 + 99 |

## 3. Completeness re-audit (E3)

Re-ran `report-completeness.ts` → `rankings-completeness-gaps-2026-06-24.md`.

| Scope                                           | Total |         Complete |    Underfilled | Empty |
| ----------------------------------------------- | ----: | ---------------: | -------------: | ----: |
| Seed-matched (published)                        |   685 | **668 (97.5 %)** | **17 (2.5 %)** |     0 |
| Unmatched (curated/pillar/chain — out of scope) |   129 |                — |              — |     — |

- **Underfilled 116 → 17 (99 resolved).**
- The **17 residual** are **editorial-quality-capped**, not a pipeline gap:
  16 short by exactly 1 entry, 1 short by 2. `--force` gave the LLM the full
  candidate pool; it declined to pad niche themes (ski Riviera, villas
  Saint-Tropez, spa Île-de-France, Santorin/Sicile boutique) with
  off-theme hotels, and `--strict` refused to publish a diluted list. Closing
  them needs **real inventory onboarding** in those micro-segments, not
  another LLM pass.

## 4. Production acceptance (E3) — FR + EN, value assertions

Prod is `force-dynamic`, so DB pushes render immediately. FR served at
`/classement/<slug>` (no prefix), EN at `/en/classement/<slug>`
(`/fr/...` → 307). All assertions read from the live DOM via `curl`.

| Page                                               | Locale | `Hotel` entries | ItemList | FAQPage | BreadcrumbList | sibling `/classement/` | dest CTA |
| -------------------------------------------------- | ------ | --------------: | :------: | :-----: | :------------: | ---------------------: | -------: |
| `meilleurs-5-etoiles-italie` (intl net-new)        | FR     |          **10** |    ✓     |    ✓    |       ✓        |                     43 |       88 |
| `meilleurs-5-etoiles-italie`                       | EN     |          **10** |    ✓     |    ✓    |       ✓        |                     43 |       66 |
| `meilleurs-5-etoiles-etats-unis` (USA net-new)     | FR     |          **10** |    ✓     |    ✓    |       ✓        |                     43 |       94 |
| `top-relais-chateaux-france` (R&C)                 | FR     |          **50** |    ✓     |    ✓    |       ✓        |                     43 |      164 |
| `top-relais-chateaux-france`                       | EN     |          **50** |    ✓     |    ✓    |       ✓        |                     43 |      102 |
| `meilleurs-hotels-provence` (resolved underfilled) | FR     |          **10** |    ✓     |    ✓    |       ✓        |                     43 |      206 |

- **Entry counts** match the DB exactly (10 / 10 / 50).
- **JSON-LD** complete on every page: `ItemList` with one `ListItem` per
  entry (+3 breadcrumb), `Hotel` nodes, `FAQPage`, `BreadcrumbList`.
- **Maillage** (Phase B): 43 sibling `/classement/` cross-links and dozens of
  `/destination/` CTAs on each page.
- **Discoverability**: the `/classements` index (HTTP 200) carries 2 466
  ranking links and references `meilleurs-5-etoiles-italie`, `etats-unis`,
  `relais-chateaux` — **1-click** from the index.

## 5. SERP baseline (E3) — deferred

`track-serp-positions.ts` uses **paid DataForSEO live SERP** calls (one per
basket query × the 3 tracked domains + domain-rank overview). A baseline was
captured **yesterday** (`serp-baseline-2026-06-24.md`); organic positions do
not re-index within 24 h of publishing. **Decision: defer the re-run to
~2-4 weeks** to actually measure the indexation effect of the +110 net-new
and 99 refilled rankings — re-running now would spend DFS budget for no signal
delta. Flagged for the next monthly tracking pass.

## 6. Residual gap vs yonder.fr

- yonder/travellers-society trust the top 1-2 SEO on "meilleurs/plus beaux
  hôtels {ville}". Phase A measured **867 qualified hotels** they cover that
  we lacked; Phase D onboarded **764**, and Phase E converted that inventory
  into **+110 published rankings** + 99 refills.
- **Coverage gap is now largely closed** on the structural axis: we
  out-structure them on machine-readability (ItemList + per-entry Hotel +
  FAQPage + Breadcrumb + hreflang + ~10 JSON-LD blocks vs their ~6) and now
  match or exceed them on city/theme/chain breadth.
- **The real residual is authority/indexation** (GSC indexation + backlinks),
  not catalogue or template — exactly as the yonder benchmark rule states.
  That is a Phase 5 (observability + GSC submit) lever, not a rankings-content
  lever. The 17 quality-capped micro-segments are a distant second.

## 7. Project progress (PO table)

| Phase                                           | Weight | Completion (2026-06-25) |
| ----------------------------------------------- | ------ | ----------------------- |
| 1 — Editorial-only on published catalogue       | 25 %   | ~97 %                   |
| 1.5 — Known gaps to close                       | 8 %    | ~90 %                   |
| 2 — Photo pipeline                              | 17 %   | ~45 %                   |
| 3 — Editorial pages (guides + rankings + itin.) | 12 %   | **~92 %** (was ~80 %)   |
| 4 — Multilingual V2/V3                          | 10 %   | ~18 %                   |
| 5 — Observability & GSC                         | 5 %    | ~30 %                   |
| 6 — Booking APIs (frozen, last brick)           | 23 %   | ~2 %                    |

→ **all-in global ≈ 53 %** · **hors-booking ≈ 70 %** (Phases 1-5
re-normalised). `Δ` Phase E: rankings completeness 97.5 % (668/685),
published rankings 704 → 814, internal maillage + JSON-LD verified live —
Phase 3 lifted ~80 % → ~92 %.

## 8. Follow-ups (not blocking)

1. **17 quality-capped micro-segments** — onboard real luxury inventory in
   those exact themes/cities (ski Riviera, villas Saint-Tropez, spa
   Île-de-France, Santorin, Sicile…), then re-run the seed `--force --strict`.
2. **SERP re-track in ~2-4 weeks** to measure the indexation effect.
3. **Authority** (GSC submit, backlinks) — the true gap vs yonder, Phase 5.
