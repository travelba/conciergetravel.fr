# Thin ranking drafts deleted — 2026-06-02

Second residual cleanup of the 2026-05-18 scaffold batch (successor to
[`thin-ranking-drafts-deleted-2026-05-31.md`](thin-ranking-drafts-deleted-2026-05-31.md),
which removed Quartier Latin / Tours / Vexin). The matrix runner filters
out rankings with fewer than `MIN_ELIGIBLE = 3` eligible hotels, so these
twelve scaffold-generated drafts stayed in `is_published = false` limbo
since **2026-05-18**. They were unreachable in prod (404), not indexed,
carried **0 `editorial_ranking_entries`**, and had empty `axes = {}`
(never bound to the combinator, so they never got a hotel list, EN
translation, meta, comparison tables, TOC, glossary, or external sources).

Eligibility was measured live on Supabase (`fsmfozxgujskluxakeoq`,
published hotels only) on 2026-06-02:

| Slug                                | Eligible hotels   | Decision   | Reason                                                                                                       |
| ----------------------------------- | ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `meilleurs-hotels-4-etoiles-france` | **0** + off-brand | **DELETE** | The catalogue has **no `4_etoiles` tier** — it is 100 % palaces / 5★ / luxury brands. The slug is off-brand. |
| `meilleurs-hotels-paris-12`         | 0 (75012)         | **DELETE** | No published luxury hotel in the 12e.                                                                        |
| `meilleurs-hotels-paris-13`         | 0 (75013)         | **DELETE** | No published luxury hotel in the 13e.                                                                        |
| `meilleurs-hotels-paris-15`         | 0 (75015)         | **DELETE** | No published luxury hotel in the 15e.                                                                        |
| `meilleurs-hotels-bercy`            | 0 (75012)         | **DELETE** | Same arrondissement as paris-12 — no inventory.                                                              |
| `meilleurs-hotels-gare-de-lyon`     | 0 (75012)         | **DELETE** | Same arrondissement as paris-12 — no inventory.                                                              |
| `meilleurs-hotels-paris-5`          | 1                 | **DELETE** | 1 hotel insufficient for a credible Top. Latin-Quarter case already arbitrated 2026-05-31.                   |
| `meilleurs-hotels-paris-2`          | 2                 | **DELETE** | 2 hotels below the floor.                                                                                    |
| `meilleurs-hotels-paris-17`         | 2                 | **DELETE** | 2 hotels below the floor.                                                                                    |
| `meilleurs-hotels-paris-18`         | 2                 | **DELETE** | 2 hotels below the floor.                                                                                    |
| `meilleurs-hotels-montmartre`       | 2 (75018)         | **DELETE** | Same arrondissement as paris-18 — 2 hotels below the floor.                                                  |
| `meilleurs-hotels-dijon`            | 2                 | **DELETE** | 2 luxury hotels in Dijon — Burgundy is better served by a future regional ranking than a thin city Top.      |

Parisian luxury inventory concentrates in the 1er / 8e / 16e / 6e / 7e
(of the 68 published Paris hotels). The 2e / 5e / 12e / 13e / 15e / 17e /
18e structurally lack palace-tier hotels, which is why these scaffolds
were never completed.

The intros (~2000c each, voix Concierge) and FAQ (7-8 Q&A each) were
scaffold-quality generic content — re-generating equivalents via the v2
pipeline costs ~30s and a few euros of tokens if a future ranking needs
them. No content snapshot kept; this audit record is the trail.

## Kept and completed

`meilleurs-hotels-lac-leman` was **kept** — Lake Geneva shore (Genève,
Lausanne, Montreux, Vevey…) carries ~12 published hotels, well above the
floor. It is being completed properly via the v2 pipeline (LieuDef with
the lakeshore cities → full FR/EN generation → publish) rather than
deleted. See the companion commit.

## Future paths

If the catalogue grows enough to warrant a related ranking later:

- **Paris arrondissements** — only build a `paris-<n>` Top once that
  arrondissement crosses 3 published luxury hotels. Today only the
  1/6/7/8/16 qualify (already covered by neighbourhood rankings).
- **Dijon / Burgundy** — prefer a regional `bourgogne` LieuDef that
  pools Dijon + Beaune + Chablis country houses over a thin city Top.

## Operation

12 rows deleted via Supabase MCP `execute_sql`
(`DELETE FROM editorial_rankings WHERE slug IN (...)` with explicit slug
list). Each carried 0 `editorial_ranking_entries`, so no cascade cleanup
was needed.

Catalogue impact:

- Rankings drafts: 13 → 1 (only `lac-leman` remains, being completed) ✅
- Rankings published: 563 → 563 (no change at deletion time)

Skill: editorial-pilot, editorial-rankings-matrix.
