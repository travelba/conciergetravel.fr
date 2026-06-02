---
title: Vague D — Audit conformité fiches hôtels
date: 2026-06-02
author: agent (Cursor)
base: origin/main @ 4368b54 (Vague A #117 + Vague C #116 mergées)
method: lecture seule (worktree détachée jetable) + Supabase prod read-only
scope: routes apps/web/**/hotel/** (fiche + sous-page chambre), builders packages/seo/src/jsonld/, composants de rendu, complétude Supabase (5 fiches échantillon)
status: accepté (verdict PO 2026-06-02 — aucun P1, gouvernance saine, 5 écarts P2/P3)
linked: R3 (force-dynamic vs ISR) → corrigé en Vague F doc (cette PR) ; R1/R2/R4/R5 différés
---

# Vague D — Audit conformité fiches hôtels (lecture seule)

> **Base auditée** : `origin/main` @ `4368b54` (contient Vague A #117 + Vague C #116 mergées), lue via worktree détachée jetable.
> **Aucune écriture, aucun commit, aucun push** lors de l'audit. Worktree supprimée après lecture.
> Données de complétude : Supabase prod (lecture seule, `execute_sql`).

---

## 1. Synthèse exécutive

### 🚨 Risques bloquants prod : **AUCUN sur l'échantillon**

Vérifié explicitement :

- Schema `Hotel` JSON-LD : **valide** (bestRating `5`, `aggregateRating` jamais fabriqué, pas d'`Offer` parasite).
- `hreflang` : **non circulaire, non invalide** (`fr-FR` → URL FR, `en` → URL `/en/...`, `x-default` → URL FR ; généré par `buildHreflangAlternates`).
- `canonical` : **pointe vers soi-même** (chemin relatif), aucun renvoi vers une 404.
- Fiche principale : **aucun `Offer` JSON-LD ni funnel live** → gel Phase 6 respecté.

### Vue d'ensemble

La couche **éditoriale + SEO/JSON-LD est solide** : sur les 5 fiches, descriptions (≥1000c), factual summary (in-band CDC), meta (in-band), FAQ (≥10), concierge advice, long_description_sections (≥7) et schémas structurés sont tous conformes. Le gel Phase 6 (`Offer`/booking) est correctement piloté par `booking_mode` (catalogue 100% `display_only` confirmé : 2219/2219).

Les écarts sont **systémiques et déjà roadmappés** (photos), ou **de cohérence/gouvernance** (rendering, surface booking sous-page, schema international). **Rien n'exige une intervention d'urgence.**

**Top 4 écarts les plus rentables à corriger** (touchent le plus de fiches) :

| #   | Écart                                                                                                                | Fiches touchées               | Priorité |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------- |
| 1   | Couverture catégorielle photos **< 10/10** (Hard Rule photo-quality)                                                 | **5/5** (4 à 9 cat.)          | P2       |
| 2   | `PostalAddress` JSON-LD **absent sur hôtels internationaux** (pas de `postal_code`)                                  | 2/5 (toute la cohorte non-FR) | P2       |
| 3   | `force-dynamic` au lieu d'ISR (rules vs réalité code désynchronisés)                                                 | **5/5** (tout le catalogue)   | P2       |
| 4   | Sous-page chambre : surface booking incohérente avec la fiche (form concierge + date pickers → `/reservation/start`) | toutes les sous-pages chambre | P2       |

---

## 2. Échantillon audité (5 fiches)

| Slug                    | Type                    | Pays | Palace | Justification                                                                                                                                                                                                                     |
| ----------------------- | ----------------------- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `les-airelles-gordes`   | Palace rural / Provence | FR   | ✅     | **Golden template** (référence supposée conforme)                                                                                                                                                                                 |
| `le-bristol-paris`      | Palace urbain           | FR   | ✅     | Palace urbain grande ville                                                                                                                                                                                                        |
| `cheval-blanc-randheli` | Resort balnéaire        | MV   | ❌     | Resort balnéaire international                                                                                                                                                                                                    |
| `le-k2-palace`          | Palace montagne         | FR   | ✅     | Boutique/montagne (Courchevel)                                                                                                                                                                                                    |
| `soneva-fushi`          | Éco-resort balnéaire    | MV   | ❌     | 5ᵉ fiche — représentative de la grande cohorte internationale non-palace (scaffold). _Aucun hôtel `booking_mode = amadeus/little` n'existe (2219/2219 = `display_only`), donc le critère 5 bascule sur une fiche représentative._ |

---

## 3. Matrice par fiche (✅ conforme / ⚠️ partiel / ❌ écart)

Données de complétude (longueurs en caractères ; `cat` = catégories photo distinctes ; `gal` = nombre de photos) :

| Critère (rule)                               | Airelles Gordes    | Le Bristol   | Cheval Blanc   | Le K2        | Soneva Fushi   |
| -------------------------------------------- | ------------------ | ------------ | -------------- | ------------ | -------------- |
| **31 §SEO** — title/meta FR+EN               | ✅ (md 145/141)    | ✅ (144/148) | ✅ (155/146)   | ✅ (150/156) | ✅ (147/140)   |
| **10** — canonical self                      | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **11** — hreflang fr-FR/en/x-default         | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **11** — parité contenu EN (desc/fs/meta)    | ✅ (en 1323)       | ✅ (1399)    | ✅ (1063)      | ✅ (1418)    | ✅ (1047)      |
| **31 §Contenu** — description ≥600c          | ✅ (1357)          | ✅ (1433)    | ✅ (1215)      | ✅ (1460)    | ✅ (1219)      |
| **seo-geo** — factual summary [130-150]      | ✅ (135)           | ✅ (142)     | ✅ (134)       | ✅ (131)     | ✅ (130)       |
| **hotel-detail §11** — FAQ ≥10               | ⚠️ (=10, plancher) | ⚠️ (=10)     | ⚠️ (=10)       | ⚠️ (=10)     | ⚠️ (=10)       |
| **editorial-voice** — concierge advice       | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **31** — long_description_sections ≥3        | ✅ (7)             | ✅ (8)       | ✅ (8)         | ✅ (9)       | ✅ (10)        |
| **photo-quality** — photos ≥10 (Phase 1)     | ✅ (12)            | ✅ (11)      | ✅ (10)        | ✅ (10)      | ✅ (10)        |
| **photo-quality** — **10 catégories**        | ⚠️ (9/10)          | ❌ (4/10)    | ❌ (6/10)      | ❌ (6/10)    | ❌ (5/10)      |
| **hotel-detail §2** — photos ≥30 (CDC idéal) | ❌ (12)            | ❌ (11)      | ❌ (10)        | ❌ (10)      | ❌ (10)        |
| **12 §schema** — Hotel + bestRating 5        | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **12 §schema** — `PostalAddress` émis        | ✅                 | ✅           | ❌ (pas de CP) | ✅           | ❌ (pas de CP) |
| **12 §schema** — geo/lat-lng                 | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **12 §schema** — pas d'`Offer` (gel P6)      | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **12 §schema** — Breadcrumb + FAQPage        | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **EEAT** — external_sources                  | ✅                 | ✅           | ✅             | ✅           | ✅             |
| **nextjs §rendering** — ISR (rules)          | ❌ `force-dynamic` | ❌           | ❌             | ❌           | ❌             |

> **Note hreflang/slug** : `slug_en` est `null` sur les 5 → l'URL EN réutilise le slug FR. **Ce n'est PAS un écart** : c'est la décision ADR-0008 (flat slug, slug EN = slug FR). De même `name_en` null sur les palaces FR → fallback nom FR (nom propre) = conforme.

---

## 4. Écarts récurrents (transverses à plusieurs fiches)

### R1 — Couverture catégorielle photos < 10/10 _(5/5 fiches)_ — **P2**

`photo-quality.mdc` et `31-hotel-page-blueprint.mdc` exigent **10 catégories couvertes** (non négociable, même Phase 1). Aucune fiche ne l'atteint : Airelles 9, K2 6, Cheval Blanc 6, Soneva 5, **Bristol 4**. Même le golden template (Airelles) est à 9/10. Cohérent avec l'état catalogue documenté (`AGENTS.md` : 10-cat coverage = 0/2219). Impact : richesse `ImageObject` + EEAT photo + indexabilité catégorielle. **Déjà roadmappé Phase 2.** Effort **XL** (sourcing + Vision pipeline).

### R2 — `PostalAddress` JSON-LD absent sur hôtels internationaux _(2/5, cohorte non-FR entière)_ — **P2**

Le builder n'émet le nœud `address` **que si `address` ET `postalCode` sont présents** (`page.tsx` L654). Cheval Blanc + Soneva (MV) n'ont pas de `postal_code` → **aucun `PostalAddress` dans le `Hotel` JSON-LD**, ce qui affaiblit le schéma sur toute la cohorte internationale (cohorte large : ~1600 hôtels hors-FR). Effort **M** (backfill CP via enrichissement, OU assouplir le gate pour émettre l'adresse sans `postalCode` quand `country_code != 'FR'`).

### R3 — `force-dynamic` au lieu d'ISR _(5/5, tout le catalogue)_ — **P2** + **gouvernance** → **CORRIGÉ (volet doc) en Vague F**

Les deux routes (`hotel/[slug]` et `chambres/[roomSlug]`) sont `export const dynamic = 'force-dynamic'`. Or `hotel-detail-page.mdc`, `nextjs-app-router.mdc` et `seo-geo.mdc` imposaient **ISR `revalidate = 3600` (ADR-0007)**. Raison réelle du `force-dynamic` côté code : **nonce CSP par requête** (`headers()`), pas une décision d'architecture ; l'ISR (ADR-0007) reste la **cible** après migration nonce→hash (suivi `isr-freshness`). La décision « fiche éditoriale d'abord » est **ADR-0025** (le code cite « ADR-0024 » par erreur connue — ADR-0024 = transform photo). **Volet doc corrigé dans cette PR (Vague F)** ; volet code (retour ISR) différé. Effort code restant **M-L**.

### R4 — Surface booking sous-page chambre incohérente avec la fiche _(toutes sous-pages chambre)_ — **P2**

- Fiche principale : `<BookingSlot>` → `booking-coming-soon.tsx` (placeholder passif "Réservation bientôt disponible", `id="booking"`).
- Sous-page chambre : `<BookingWidget>` qui, en `display_only`, rend un **formulaire concierge GET avec sélecteurs de dates** → `/reservation/start`.

Deux traitements différents de la même promesse en Phase 1. `AGENTS.md §4ter` veut un **CTA éditorial**, pas un funnel à dates pointant vers `/reservation/start`. À vérifier : existence/innocuité de `/reservation/start` en Phase 1. Effort **S-M** (aligner la sous-page sur le placeholder, ou neutraliser le date-picker).

### R5 — FAQ au plancher (=10) + question canonique "transferts" _(5/5)_ — **P3**

`hotel-detail-page.mdc` vise **10-15 Q&A** ; les 5 fiches sont à exactement 10. `AGENTS.md` documente par ailleurs que la question canonique "transferts" n'est couverte qu'à ~60.8% du catalogue. Effort **M** (extension FAQ ciblée).

---

## 5. Ce qui est conforme (à ne PAS retoucher)

- **Gel Phase 6** : aucun `Offer`/funnel live sur la fiche ; chemin `Offer` sous-page **dormant** et gaté par `booking_mode` (exactement comme documenté en Vague C / B-2). ✅
- **bestRating `5`** hardcodé dans le builder ; `aggregateRating` émis seulement si `reviewCount > 0` (Amadeus puis fallback Google). ✅
- **Ancres TOC + speakable** (`#en-bref`, `#factual-summary`, `#concierge-advice`, `#faq`, `#booking`, `#recit`, `#services`, `#chambres`, `#lieu`, `#avis`, `#conseil`) : **toutes résolvent** vers un composant/span réel — aucune ancre morte. ✅
- **hreflang** centralisé (`buildHreflangAlternates`), `x-default` présent, exhaustif sur `routing.locales`. ✅
- **Canonical self** + `noindex,follow` propre sur les fiches stub (gate `isHotelIndexable`). ✅
- **ImageObject** `representativeOfPage` sur le hero + `width/height` (issus des transforms Cloudinary, donc présents dans le JSON-LD **même si** la DB `gallery_images` n'a pas les dimensions). ✅
- Sous-page chambre : `HotelRoom` + `containedInHotelUrl` + breadcrumb + canonical self + gate `noindex` (<5 photos / <200 mots). ✅

---

## 6. Classement P1 / P2 / P3 + effort

| Écart                                | Impact                              | Priorité | Effort | Statut                               |
| ------------------------------------ | ----------------------------------- | -------- | ------ | ------------------------------------ |
| R1 — Couverture 10 catégories photos | SEO/GEO/EEAT (Hard Rule)            | **P2**   | XL     | Roadmappé Phase 2                    |
| R2 — `PostalAddress` absent (intl)   | SEO (schema affaibli, ~1600 fiches) | **P2**   | M      | Nouveau                              |
| R3 — `force-dynamic` vs ISR          | Perf/SEO/crawl + gouvernance        | **P2**   | M-L    | Doc corrigé (Vague F) ; code différé |
| R4 — Surface booking sous-page       | Cohérence Phase-6 / UX              | **P2**   | S-M    | Nouveau                              |
| R5 — FAQ plancher + "transferts"     | SEO/AEO (gain marginal)             | **P3**   | M      | Connu                                |
| Volume photos ≥30 (CDC idéal)        | SEO (idéal, non-bloquant)           | **P3**   | XL     | Roadmappé Phase 2                    |

**Aucun P1.** L'absence d'écart bloquant + la conformité éditoriale/schema expliquent ce classement : tous les écarts sont des optimisations ou des dettes de cohérence, pas des cassures.

---

## 7. Recommandations de regroupement (Vagues de correction)

| Vague                                   | Périmètre                                                                                                                                                                                                                | Écarts      | Effort | Quick win ?                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ | --------------------------------------------- |
| **Vague E — Schema international**      | Assouplir le gate `PostalAddress` (émettre l'adresse sans CP si `country_code != 'FR'`) OU backfill `postal_code` intl                                                                                                   | R2          | M      | ✅ oui (1 fix code dans `page.tsx` + builder) |
| **Vague F — Stratégie de rendu**        | Volet doc (cette PR) : réconcilier rules ↔ réalité code (force-dynamic transitoire, ISR ADR-0007 = cible, ADR-0025 = fiche éditoriale). Volet code (différé) : migration nonce CSP → hash + retour ISR `revalidate=3600` | R3          | M-L    | Doc = S, code = L                             |
| **Vague G — Cohérence surface booking** | Aligner la sous-page chambre sur le placeholder passif de la fiche (ou neutraliser date-picker → CTA concierge éditorial)                                                                                                | R4          | S-M    | ✅ oui                                        |
| **Vague H — Photos (Phase 2)**          | Couverture 10/10 catégories + montée vers 30 photos + `width/height` DB                                                                                                                                                  | R1 + volume | XL     | ❌ (chantier dédié déjà planifié)             |
| **Vague I — FAQ tightening**            | Forcer la question "transferts" manquante + viser 12 Q&A                                                                                                                                                                 | R5          | M      | non                                           |

**Ordre conseillé** : **E → G → F(doc) → I → F(code) → H**. _(F volet doc traité dans cette PR.)_

---

_Fin du rapport. Audit en lecture seule — aucun fichier applicatif modifié lors de l'audit. Archive figée le 2026-06-02._
