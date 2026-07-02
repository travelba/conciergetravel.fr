# Plan d'exécution post-audit — juillet 2026

**Date** : 2026-07-02
**Source** : `docs/audits/audit-complet-projet-2026-07-02.md` (audit 4 volets :
parcours prod A→Z, front, back, SEO/GEO)
**Horizon** : ~4 semaines de production active (7 vagues)
**Principe directeur** : le site est déjà sur-structuré côté machine ; chaque
euro d'effort va désormais à ce qui débloque la **visibilité** (autorité,
crawl, contenu propre) et la **confiance** (claims exacts, EN natif, perf).

---

## 0. Les 3 paris du plan

1. **Le goulot est l'autorité + le crawl, pas l'on-page.** On arrête de
   sur-optimiser des pages que Google ne visite pas ; on rend le site
   rapide à crawler (Vague 3) et on nettoie ce qui est déjà indexé
   (Vague 1) pendant que le pack autorité tourne en continu (Vague 4).
2. **Un contenu faux coûte plus cher qu'un contenu absent.** Les claims
   Palace périmés et l'EN mélangé au FR sont des poisons EEAT — ils
   passent avant toute création nette.
3. **Une décision de gouvernance ne se code pas.** La contradiction
   Phase 6 (gel documenté vs Amadeus/Travelport live) se tranche par le
   PO en Vague 0, sinon elle re-fuit dans chaque sprint.

---

## Vague 0 — Décisions & garde-fous (J1, ~1 jour)

Objectif : fermer les risques immédiats et lever les ambiguïtés qui
bloquent les vagues suivantes. Aucune dépendance externe.

| #   | Action                                                                                                                                                                                                                                                                                                                                       | Fichiers / surface                                                           | Effort           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| 0.1 | **Décision PO Phase 6** : (a) gel réel → couper `getBestOfferForHotel`, `getAmadeusHotelSentiment`, Travelport search/cron/UI des routes publiques derrière `isPhase6BookingEnabled()` ; ou (b) dé-gel assumé → mettre à jour AGENTS.md §4ter + ADR. Recommandation : **(a)** — cohérent avec la stratégie éditoriale ET gain TTFB immédiat. | `prepare-hotel-booking-rail.ts`, `hotel/[slug]/page.tsx`, `api/travelport/*` | 0,5 j (option a) |
| 0.2 | **Rate limit fail-closed** : Redis indisponible → 429 (ou 503) sur `/api/agent/*`, jamais passage sans limite. Test unitaire du chemin d'erreur.                                                                                                                                                                                             | `apps/web/src/server/agent/rate-limit.ts`                                    | 0,25 j           |
| 0.3 | **Mentions légales** : compléter les placeholders `[À COMPLÉTER]` (raison sociale, SIREN, hébergeur, médiateur tourisme) ou retirer le lien footer tant que draft.                                                                                                                                                                           | `(legal)/mentions-legales/page.tsx`, `i18n/messages/*`                       | 0,25 j           |
| 0.4 | **Titre dupliqué site-wide** : corriger le template qui produit « … \| MyConciergeHotel à MyConciergeHotel » (home, lieux, itinéraires…).                                                                                                                                                                                                    | `packages/seo/src/metadata.ts` + layouts                                     | 0,25 j           |

**Acceptation** : décision Phase 6 écrite (ADR ou AGENTS.md) ; test
rate-limit rouge→vert ; walk `/mentions-legales` fr+en ; titres vérifiés
sur 5 pages via curl.

---

## Vague 1 — Nettoyage du contenu à risque (J2-J4, ~2-3 jours)

Objectif : exécuter la **Vague 1 du plan DataSEO** (29/06, jamais lancée)
— corrections déterministes uniquement, zéro régénération lourde.

| #   | Action                                                                                                                                                                                                                                                                                                                                                                 | Détail |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.1 | **Claims Palace** : aligner tout le catalogue sur la liste officielle Atout France juin 2026 (33 Palaces, 13 à Paris, révision 3 ans). Corriger en priorité `/en/categorie/palaces-paris` (cite Ritz + Park Hyatt à tort, « twelve », « five years ») et les 10 fiches P0 du plan (the-berkeley, ritz, claridge's, burj-al-arab…). Sourcer chaque claim ou le retirer. |
| 1.2 | **Meta titles cassés** : réparer pipes/troncatures sur les fiches et classements signalés.                                                                                                                                                                                                                                                                             |
| 1.3 | **FAQ langue mélangée** : purger le FR des surfaces EN (`/en/classements/lieu/paris` : « Sélection éditoriale… », « 8-star hotels », dates « 2023 »).                                                                                                                                                                                                                  |
| 1.4 | **PAA bruitées** : retirer célébrités/fortunes/salaires des FAQ/geo_qa.                                                                                                                                                                                                                                                                                                |
| 1.5 | **Angles Phase 6** : retirer « Amadeus net rates, no commission » et toute promesse booking/prix live du contenu indexé (cohérent avec la décision 0.1).                                                                                                                                                                                                               |

**Méthode** : runner `patch-dataseo-p0-hotels.ts` (déjà en cours, non
commité) + `--dry-run` d'abord ; re-audit DataSEO sur les slugs traités ;
`hasLeak()` sur tout texte modifié.

**Acceptation** : re-run `dataseo:audit` avant/après sur les 30 entités ;
walk fr+en des pages corrigées ; 0 claim Palace non sourcé sur les slugs
traités ; commit par lots de 20-30 entités max.

---

## Vague 2 — Parité EN (J5-J9, ~3-4 jours)

Objectif : l'EN génère déjà plus d'impressions que le FR avec un CTR de
0,18 % — le contenu stub sabote la seule locale qui a du potentiel court
terme.

| #   | Action                                                                                                                                                   | Volume     | Outil                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| 2.1 | `intro_en` des classements (LLM EN natif, pas de traduction littérale, voix Concierge)                                                                   | 795 stubs  | pipeline sibling de `translate-sections-en.ts`, gate `hasLeak()` + grounding `groundKeywords` EN |
| 2.2 | Justifications EN des entrées de classement                                                                                                              | 274 stubs  | `enrich-ranking-justifications.ts` mode EN                                                       |
| 2.3 | Sections éditoriales EN des classements                                                                                                                  | 272 rows   | même vague, chunké 4 sections/call (leçon 7th wave)                                              |
| 2.4 | **i18n des chaînes hardcodées** sur les pages classements (`classement/[slug]` L544/743, `classements` L369, `[axe]/[valeur]` L355) + `global-error.tsx` | 5 fichiers | next-intl                                                                                        |

**Ordre interne** : 2.4 d'abord (déterministe, 0,5 j), puis 2.1 → 2.2 →
2.3 par lots de 50 avec re-audit. Prioriser les classements à intention
internationale (Londres, Rome, Dubaï, NYC, villes yonder).

**Acceptation** : échantillon 10 pages EN walkées (0 FR résiduel, 0
mistranslation type « 8-star ») ; `dfs_paa_coverage` logué ; typecheck +
tests verts.

---

## Vague 3 — Performance & crawl (J8-J14, ADR + ~4-5 jours, parallélisable avec V2)

Objectif : passer de « chaque hit = 3-12 s de SSR » à « fiche et
destination servies en cache CDN ». C'est le plus gros levier crawl
budget ET UX du projet.

| #   | Action                                                                                                                                                                                                                         | Détail                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 3.1 | **ADR « CSP nonce → hash »** (ou double stratégie : hash pour le JSON-LD statique par build, nonce conservé uniquement sur les routes authentifiées). Sans cette décision, l'ISR HTML est impossible — c'est le verrou racine. | `docs/adr/00xx-csp-hash-isr.md`, `csp.ts`, `proxy.ts`, `JsonLdScript` |
| 3.2 | **Réactiver l'ISR** (`revalidate = 3600`) sur les 4 routes de tête : `/hotel/[slug]`, `/destination/[citySlug]`, `/classement/[slug]`, `/lieux/**`. Invalidation par `revalidateTag` existante.                                | pages concernées                                                      |
| 3.3 | **Sortir les vendors du chemin de rendu** (si option 0.1a : suppression pure ; sinon : `Suspense` + cache Redis + timeout court). Cible : le HTML de la fiche ne dépend plus d'un appel Amadeus.                               | `hotel/[slug]/page.tsx`, `prepare-hotel-booking-rail.ts`              |
| 3.4 | **Paginer `/hotels`** : 10,4 Mo → index par pays/ville + pagination (ou seuil 100 hôtels/page), maillage conservé via `hubs.xml` + pages pays.                                                                                 | `hotels/page.tsx`                                                     |
| 3.5 | **États de chargement** : `loading.tsx` sur hotel/destination/classement, `error.tsx` segment fiche.                                                                                                                           | segments concernés                                                    |
| 3.6 | Mesure avant/après : TTFB p50/p95 sur 20 URLs, `x-vercel-cache` HIT ratio, re-crawl GSC.                                                                                                                                       | script de mesure réutilisable                                         |

**Acceptation** : `x-vercel-cache: HIT` sur fiche + destination au 2e
hit ; TTFB < 800 ms en HIT ; `/hotels` < 500 Ko ; CSP toujours sans
`unsafe-inline` script (tests `csp.test.ts` étendus) ; walk complet
fr+en desktop+mobile (règle user-acceptance).

---

## Vague 4 — Autorité & couverture (continu dès J5, setup ~2-3 jours)

Objectif : attaquer le vrai delta vs yonder (15 568 keywords vs 2). Rien
d'on-page ne compensera un profil de liens vide.

| #   | Action                                                                                                                                                                                                                                                    | Détail                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 4.1 | **Matrice lexicale volume** : générer les slugs `hotel-de-luxe-{ville}` (FR) / réorienter titles+H1 EN sur « luxury hotels {city} » — le volume est 10-30× le phrasé « meilleurs hôtels ». Grounded DataForSEO, gate PAA.                                 | `combinator.ts` + `run-rankings-v2-bulk.ts`             |
| 4.2 | **12 rankings géo gap yonder** (Vienne, Crète, Lisbonne…) — uniquement si inventaire ≥ 4 hôtels ; sinon scaffold fiches d'abord.                                                                                                                          | matrice + audit inventaire                              |
| 4.3 | **Pack backlinks/PR** : dossier de presse (page existante), partenariats (Atout France, R&C, offices de tourisme), annuaire IATA, HARO/journalistes voyage, données citables (les classements + l'API sources EEAT sont des aimants naturels à citation). | hors code, cadence hebdo                                |
| 4.4 | **EEAT data** : combler les ~150 hôtels sans `external_sources`, resynchroniser les 27 % de fiches sans AggregateRating Google.                                                                                                                           | `convert-wikidata-to-external-sources.ts`, sync ratings |
| 4.5 | **GSC ops** : résoumission des 7 sitemaps (guides.xml désormais peuplé), suivi hebdo impressions/couverture, tableau de bord.                                                                                                                             | GSC + `authority-visibility-plan.md`                    |

**Acceptation** : 12 nouveaux classements walkés ; impressions GSC en
croissance sur 4 semaines (KPI, pas garantie) ; ≥ 5 backlinks réels
obtenus sur le mois.

---

## Vague 5 — Conformité pipelines & observabilité (J15-J18, ~2-3 jours)

Objectif : verrouiller la règle PO « tout contenu est DataForSEO-grounded
et hasLeak-gated » sur 100 % des générateurs, et rendre l'exploitation
observable.

| #   | Action                                                                                                                                                                                                                                     | Détail                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 5.1 | Câbler `groundHotel` + `hasLeak()` sur `premium-section-generator.ts` ; gate PAA sortie sur `enrich-hotel-content.ts` (long_description) et `enrich-places-editorial.ts`.                                                                  | règle `dataforseo-content-grounding.mdc` §backlog |
| 5.2 | Marquer/retirer les générateurs legacy non conformes (`generate-guide.ts` v1, `generate-ranking.ts` v1, `description-extend`, `humanizer-faq`, `rankings/meta-desc-generator.ts`) — bannière « deprecated, ne pas lancer » ou suppression. | scripts/editorial-pilot                           |
| 5.3 | **Persister `dfs_paa_coverage` en DB** (colonne ou table de runs) pour permettre l'audit catalogue sans re-run.                                                                                                                            | migration + runners                               |
| 5.4 | **Brancher pino** (`@mch/observability`) sur les chemins server chauds (get-hotel-by-slug, agent routes) en remplacement des `console.*`.                                                                                                  | ~15 fichiers server                               |
| 5.5 | **Unifier l'indexabilité** : la RPC SQL (`0078`) délègue ou est générée depuis le prédicat TS (source unique), test de non-divergence.                                                                                                     | `indexability.ts` + migration                     |
| 5.6 | **Sécuriser le kit HTML** : sanitisation (ou whitelist de rendu) du `mainHtml` injecté par `hotel-page-kit.tsx`.                                                                                                                           | `hotel-page-kit.tsx`                              |

**Acceptation** : grep « générateur sans gate » = 0 sur les pipelines
actifs ; 1 dashboard (ou requête SQL) de couverture PAA catalogue ;
0 `console.log` sur les chemins migrés.

---

## Vague 6 — Fond de panier P2 (fil rouge, non bloquant)

À traiter en interstitiel ou en fin de sprint :

- llms.txt : émettre les URLs canoniques (sans `/fr/`) + rafraîchir les
  compteurs ; corriger `robots.txt` (`/compte/` sans préfixe).
- Vidéo hôtel : lecteur DOM pour matcher le `VideoObject` (CDC §2).
- Header homepage aligné sur les hubs réels (mega-menu ou liens directs
  `/hotels`, `/destination`, `/le-concierge-club`).
- Tests JSON-LD manquants (Article, Breadcrumb, HotelRoom, CollectionPage).
- Dédoublonnage scripts v1/v2 ; drift AGENTS.md (2 219 vs 2 929 hôtels) ;
  gate `/dev/*` en prod ; health endpoint avec checks réels.
- **Photos Phase 2** (10 catégories CDC, ≥ 30/fiche) : reste séquencé
  APRÈS l'écrit, conformément à la décision PO 2026-05-25 — planifié,
  pas exécuté ici.

---

## Séquencement & parallélisation

```
Semaine 1 : V0 (J1) → V1 (J2-J4) → démarrage V4 (backlinks/GSC, continu)
Semaine 2 : V2 (EN) ∥ V3.1-3.2 (ADR CSP + ISR)
Semaine 3 : V3.3-3.6 (vendors, /hotels, mesures) ∥ V4.1-4.2 (matrice lexicale)
Semaine 4 : V5 (pipelines/observabilité) ∥ V4 continu ∥ V6 interstitiel
```

Deux flux parallélisables en permanence : **contenu** (V1→V2→V4) et
**plateforme** (V0→V3→V5) — ils ne touchent pas les mêmes fichiers.

## Gouvernance (inchangée vs plan DataSEO)

- Lots de 20-30 entités max, dry-run systématique, re-audit après chaque
  vague, walk fr+en avant tout commit (règle user-acceptance).
- Stop conditions : erreur API répétée, réintroduction de scaffolding,
  correction qui touche prix live/booking sans décision 0.1.
- Reporting : mini-table de progression phases (AGENTS.md §4ter) à la fin
  de chaque tâche, KPI hebdo GSC (impressions, pages avec impressions,
  positions sur 20 requêtes cibles).

## KPIs de succès (M+1)

| KPI                                      | Baseline (02/07)         | Cible M+1    |
| ---------------------------------------- | ------------------------ | ------------ |
| Pages avec impressions GSC               | ~191 / 8 202 (2,3 %)     | > 800 (10 %) |
| TTFB fiche hôtel (HIT)                   | 3-4,5 s (MISS permanent) | < 800 ms     |
| `x-vercel-cache` HIT ratio pages de tête | 0 %                      | > 80 %       |
| Classements `intro_en` réels             | 68 / 863 (8 %)           | 863 (100 %)  |
| Claims Palace non sourcés                | > 0 (constaté prod)      | 0            |
| Poids `/hotels`                          | 10,4 Mo                  | < 500 Ko     |
| Pipelines actifs sans gate DFS+hasLeak   | 6                        | 0            |
| Backlinks référents obtenus              | ~0                       | ≥ 5          |
