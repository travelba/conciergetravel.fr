# Handoff reprise — nuit 2026-06-25 → 26 (data seo + FAQ grounded + maillage)

> Préparé avant extinction machine ~03:00. Tout le travail ci-dessous est
> **commité + poussé sur `main`** (ou persisté en base Supabase, qui est
> distante donc non affectée par l'extinction). Les 4 shards FAQ tournaient
> en local : ils s'arrêtent à l'extinction, reprise idempotente.

## État à l'extinction

- **FAQ kit grounded DataForSEO : 2896 / 2984 fiches publiées (97,1 %)** — au
  démarrage de la nuit on était à 8 (0,3 %). Écriture encore active sur les
  3 derniers shards (queue de partition).
- **0 mur de quota Perplexity** sur la reprise grounded (concurrency 3 a lissé
  la dépense). Coût grounded shard 0 ≈ $81 (cumul ≈ $112).

## Livré + poussé cette nuit (commits sur `main`)

1. **Directive « data seo » codifiée** (ta consigne du soir) :
   - `cf633ad9` — CDC `hotel-detail-page.mdc` (principe grounding) + hard rule
     `AGENTS.md` §4 **8ter**.
   - `77d33bce` — pipeline FAQ kit **grounded de bout en bout** (groundHotel à
     l'entrée + gate `evaluatePaaCoverage` en sortie + flag `--grounded`) +
     règle always-apply `.cursor/rules/dataforseo-content-grounding.mdc` + skill.
   - `09710e70` — même gate PAA câblé en sortie du **générateur de classements**
     (generate-ranking-v2 + enrich-ranking-faq-grounded).
   - KPI `dfs_paa_coverage` fiabilisé (filtrage du bruit PAA people/prix au
     dénominateur, 384 tests verts).
2. **Finitions classements grounded vs yonder** : dédoublonnage Carlton Cannes,
   clés london/dubai verrouillées par tests, Barcelone FS_en réparé, piscine-dubai
   sources EEAT (2→5), densité gastronomie-tokyo (1→7) + piscine-bali via signal
   `michelin_stars` structuré.
3. **Maillage — 4 bugs d'orphelins corrigés** (anti-pattern `.limit()` / cap 1000) :
   - `/lieux/[ville]` : cap 200 → pagination indexable (**779 POI Paris**, 579
     étaient orphelins) — `c3fe54b3`.
   - `/destination` : clamp 1000 → `~23/127 pays` réapparaissent — `8266a700`.
   - `/classements` + sitemap rankings + corpus agent : cap implicite 1000 à
     **816/1000** (casse imminente) → paginé proactivement — `600f127c`.
   - bloc « classements liés » : idem paginé.
4. **Acceptance intermédiaire grounded** : 🟢 VERT, 0 problème systémique
   (913 fiches in-band, 0 fuite, parité EN, gates OK).

## RESTE À FAIRE (reprise)

1. **Mop-up FAQ (~88 fiches sans kit)** — relancer les 4 shards en grounded
   (idempotent, re-skippe les 2896 faites) :
   ```powershell
   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-faq-perplexity-batch.ts -- --segment=rest --shards=4 --shard=0 --grounded --concurrency=3
   # idem --shard=1 | 2 | 3
   ```
2. **2 résidus durs** : `pikaia-lodge`, `quisisana-resort` — échec déterministe
   du gate `promote.canonical` (source trop pauvre pour assembler les 10 Q
   canoniques après 3 tentatives). → assouplir le gate canonical OU passe
   éditoriale manuelle. Pas un re-run.
3. **Backfill cache DataForSEO** pour les fiches enrichies `grounding=off`
   (sans cache DFS), puis régénération grounded pour remonter `dfs_paa_coverage`.
4. **AUDIT FINAL COMPLET** (demandé par le PO « une fois fini ») — à déclencher
   sur l'état convergé, parallélisé multi-axes, synthèse unique priorisée :
   **contenu / SEO / GEO / maillage / photos / projet (% par phase, matrice
   AGENTS §4ter) + comparaison yonder.fr**.

## Vérifications post-reprise (acceptance reportée — shell instable cette nuit)

- Curl prod `https://myconciergehotel.com/hotel/<slug>` FR+EN : HTTP 200,
  bloc FAQ rendu, JSON-LD `FAQPage` (15 `Question` = sous-ensemble promote),
  0 marqueur de fuite.
- Curl `/destination`, `/classements`, `/lieux/paris?page=2` : compteurs non
  nuls, pager `rel=next`, entités au-delà des anciens caps atteignables.
