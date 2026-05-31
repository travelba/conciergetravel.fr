# Thin ranking drafts deleted — 2026-05-31

Track A residual cleanup (after the 2026-05-31 17:00 push that resolved
7 geographic rankings + the T+L 2025 curated list). The matrix runner
filters out rankings with fewer than `MIN_ELIGIBLE = 3` hotels, so
these three scaffold-generated drafts stayed in `is_published=false`
limbo since 2026-05-18. They were unreachable in prod (404) and not
indexed.

Deletion rationale:

| Slug                              | Eligible hotels                                            | Decision   | Reason                                                                                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meilleurs-hotels-quartier-latin` | 2 (Maison Colbert + Lutetia, Lutetia limite Saint-Germain) | **DELETE** | 1 vrai hôtel central insuffisant pour un Top crédible. Le Lutetia (45 bd Raspail) appartient plutôt à un futur `saint-germain-des-pres`.                                                                         |
| `meilleurs-hotels-tours`          | 1 (Les Trésorières) — ville stricte                        | **DELETE** | 1 hôtel sur Tours intra-muros. "Châteaux de la Loire" déjà couvert par 3 rankings publiés (`meilleurs-5-etoiles-loire`, `meilleurs-hotels-charme-loire`, `meilleurs-hotels-montagne-loire`). Inutile de doubler. |
| `meilleurs-hotels-vexin`          | 0 — pure artefact scaffold                                 | **DELETE** | Aucun hôtel publié dans le Vexin / Val d'Oise. Aucun pipeline à court terme.                                                                                                                                     |

The intros (~2000c each, voix Concierge) and FAQ (7-8 Q&A each, voix
Concierge) were scaffold-quality generic content — re-generating
equivalents via the v2 pipeline costs ~30s and a few euros of tokens
if a future ranking needs them. No content snapshot kept; this audit
record is the trail.

If the catalogue grows enough to warrant a related ranking later, the
correct path is:

- **Saint-Germain-des-Prés** rather than "Quartier Latin" (the Lutetia
  ends up on Raspail-Saint-Germain, not 5e). Slug suggestion:
  `meilleurs-hotels-saint-germain-des-pres` (`scope: quartier`).
- **Val de Loire extended** rather than "Tours" (the 13 Loire hotels
  are clustered in Cheverny, Onzain, Amboise, Boismorand, Reugny… not
  Tours itself). Currently covered by 3 lean rankings (5★, charme,
  montagne) — extend the `loire` LieuDef in `axes.ts` to broaden the
  matching list (`hotelCityKeys` currently only catches 5 cities).
- **Vexin-Giverny** when at least 3 luxury hotels are added to the
  catalogue in the Val-d'Oise / Eure / Yvelines countryside.

Operation: 3 rows deleted via Supabase MCP `execute_sql` (DELETE on
`editorial_rankings WHERE slug IN (...)` with explicit slug list).
Cascading FK deletes on `editorial_ranking_entries` cleaned the 0
entries each had.

Catalogue impact:

- Rankings drafts: 3 → 0 ✅
- Rankings published: 217 / 217 (no change)

Skill: editorial-pilot, editorial-rankings-matrix.
