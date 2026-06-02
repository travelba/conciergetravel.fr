---
title: MDC Quality Audit — N1 lint statique + N2 scénarios boîte noire
date: 2026-06-02
author: agent (QA/MDC)
base: origin/main (post-#116…#123)
scope: doc-only, lecture seule code — DÉTECTION sans correction
status: livré
branch: docs/test-rules-mdc-audit
---

# MDC Quality Audit — `.cursor/rules/*.mdc`

> **Objet** : auditer la qualité des 26 MDC en `main` (Vagues A/C/D/F + legacy)
> sur deux niveaux : **N1 lint statique** (front-matter, globs, liens, contradictions,
> hygiène) et **N2 scénarios boîte noire** (prompts positif/négatif + critères,
> prêts à exécuter manuellement). **Aucune correction** n'est proposée ici
> (séparation détection / correction). **Aucune exécution agent réelle.**

---

## 1. Synthèse exécutive

- **26 MDC** auditées dans `.cursor/rules/`.
- **Scores N1** : ✅ **11** · ⚠️ **14** · ❌ **1**.
- **Score N2** : **26 / 26** scénarios générés (positif + négatif + critères), tous en statut **⏸ pending manual run** (pas d'exécution agent).
- **Aucun P1** (rien de bloquant prod : aucun front-matter cassé, aucun lien ADR mort, aucune MDC orpheline, EOL 100 % LF).

### Top 5 problèmes (par priorité)

| # | Prio | MDC | Problème | Driver |
|---|------|-----|----------|--------|
| 1 | **P2** | `31-hotel-page-blueprint.mdc` | Contradiction interne : L23 « éditorial-first = **ADR-0025** (pas 0024) » mais L82 attribue « ne fetch aucune offre » à **ADR-0024**. | E / D |
| 2 | **P2** | (systémique) | **Overlap de globs** : éditer un fichier de fiche hôtel auto-attache ~12 MDC (set `alwaysApply:true` + globs `apps/web/**` larges de 10/12/30/31/40/41). Budget contexte lourd. | C |
| 3 | **P3** | `photo-quality.mdc` | Chemin périmé `packages/ui/src/cloudinary.ts` (réel : `packages/ui/src/cloudinary-presets.ts`) dans glob + corps. | B / D |
| 4 | **P3** | `nextjs-app-router.mdc` | L70 cite « ADR-0004 for the layout decision » alors qu'**ADR-0004 = Algolia** (le lien résout mais le sujet ne correspond pas). | D |
| 5 | **P3** | `10-seo-foundations`, `itinerary-page`, `seo-geo` | Trailing whitespace résiduel (1 / 5 / 1 lignes). | F |

### Recommandation (neutre)

- **P2 #1** mérite une correction rapide (1 caractère : `(ADR-0024)` → `(ADR-0025)` à L82) dans une **Vague F-bis séparée** (modifie une MDC → hors gel détection-only de cette PR).
- **P2 #2** est une **dette consciente** : les MDC transverses Vague A ont volontairement des globs larges. Piste : restreindre les globs des numérotées 10/12/30/40/41 aux surfaces réellement concernées, OU les passer en `alwaysApply:false` sans globs (déclenchement par description, comme 01/14/20). À arbitrer, pas urgent.
- **P3** : nettoyage cosmétique (trailing ws) + correction de 2 pointeurs (cloudinary, ADR-0004) regroupables dans la même Vague F-bis.

---

## 2. Inventaire MDC

> Lignes via `Measure-Object -Line` (indicatif). « Vague » = origine de la version actuelle.

| MDC | alwaysApply | Globs (résumé) | Lignes | Vague |
|-----|-------------|----------------|--------|-------|
| `01-project-overview.mdc` | false | — (manuel) | 95 | A |
| `10-seo-foundations.mdc` | false | `apps/web/**`, `packages/seo/**` | 130 | A |
| `11-seo-multilingue.mdc` | false | `apps/web/**`, `packages/seo/**` | 97 | A |
| `12-schema-ota.mdc` | false | `apps/web/**`, `packages/seo/**` | 92 | C |
| `14-agent-routing.mdc` | false | — (manuel) | 128 | A |
| `20-agents-overview.mdc` | false | — (manuel) | 126 | A |
| `30-programmatic-pages.mdc` | false | `apps/web/**` | 91 | A |
| `31-hotel-page-blueprint.mdc` | false | `apps/web/**/*hotel(s)*` | 94 | C/F |
| `40-llms-txt-strategy.mdc` | false | `packages/seo/**`, `apps/web/**` | 43 | A |
| `41-robots-agents-permissions.mdc` | false | `packages/seo/**`, `apps/web/**` | 51 | A |
| `architecture-layers.mdc` | true | `{packages,apps}/**` | 49 | legacy |
| `code-conventions.mdc` | true | `**/*.{ts,tsx}` | 43 | legacy |
| `commit-conventions.mdc` | false | — (manuel) | 62 | legacy |
| `e2e-testing.mdc` | true | `apps/web/{e2e,src/server}/**` | 47 | legacy |
| `editorial-voice.mdc` | true | — (pointeur) | 29 | legacy |
| `hotel-detail-page.mdc` | true | `apps/web/src/app/[locale]/hotel/[slug]/**` | 78 | F |
| `integrations-api.mdc` | true | `packages/integrations/**` | 48 | legacy |
| `itinerary-page.mdc` | false | `apps/web/src/app/**/itineraire*/**` | 174 | legacy |
| `nextjs-app-router.mdc` | true | `apps/web/**` | 52 | F |
| `observability-perf.mdc` | true | `{apps,packages}/**` | 34 | legacy |
| `photo-quality.mdc` | true | liste brace (hotel/photos/cloudinary…) | 82 | legacy |
| `security-csp.mdc` | true | `{apps,packages}/**/*.{ts,tsx,sql}` | 35 | legacy |
| `seo-geo.mdc` | true | `{packages/seo,apps/web/src/app}/**` | 138 | C/F |
| `skills-capitalisation.mdc` | true | — (always-on) | 52 | legacy |
| `supabase-rls.mdc` | true | `{packages/db,apps/admin}/**` | 35 | legacy |
| `user-acceptance-before-commit.mdc` | true | — (always-on) | 124 | legacy |

---

## 3. N1 — Résultats lint

Légende drivers :
**A** front-matter YAML · **B** globs ≥ 1 fichier · **C** overlap globs · **D** liens internes · **E** contradictions keywords · **F** hygiène.
Symboles : ✅ ok · ⚠️ mineur · ❌ erreur · ➖ N/A.

| MDC | A | B | C | D | E | F | Verdict |
|-----|---|---|---|---|---|---|---------|
| 01-project-overview | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10-seo-foundations | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ |
| 11-seo-multilingue | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| 12-schema-ota | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| 14-agent-routing | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 20-agents-overview | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 30-programmatic-pages | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| 31-hotel-page-blueprint | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ❌ |
| 40-llms-txt-strategy | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| 41-robots-agents-permissions | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| architecture-layers | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| code-conventions | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| commit-conventions | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| e2e-testing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| editorial-voice | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| hotel-detail-page | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| integrations-api | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| itinerary-page | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| nextjs-app-router | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ |
| observability-perf | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| photo-quality | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ |
| security-csp | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| seo-geo | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ |
| skills-capitalisation | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| supabase-rls | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| user-acceptance-before-commit | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Détails warnings / errors

**A — Front-matter (✅ partout)**
Les 26 MDC ont `description` + `alwaysApply`. Les 6 sans `globs` sont soit `alwaysApply:true`
(editorial-voice, skills-capitalisation, user-acceptance-before-commit — déclenchement always-on),
soit `alwaysApply:false` sans globs (01, 14, 20, commit-conventions — **règles manuelles** déclenchées
par description). YAML valide dans tous les cas.

**B — Globs orphelins**
- ⚠️ `photo-quality.mdc` (L3) : la liste brace inclut `packages/ui/src/cloudinary.ts` qui **n'existe pas**.
  Réel : `packages/ui/src/cloudinary-presets.ts` (vérifié `git ls-files`). Les autres segments matchent
  (`hotel-gallery.tsx`, `hotel-hero.tsx`, `apps/web/**/hotel/**`, `scripts/photos/**`, `packages/seo/src/jsonld/hotel.ts`),
  donc la MDC **n'est pas orpheline globalement**, mais le segment est mort. → **P3**.
- ✅ `itinerary-page.mdc` : `apps/web/src/app/**/itineraire*/**` matche `app/[locale]/itineraire/[slug]/page.tsx`
  ET `app/[locale]/itineraires/page.tsx`. Pas orphelin.

**C — Overlap globs (⚠️ systémique, voir §5)**
Le set `alwaysApply:true` (code-conventions `**/*`, architecture-layers, observability-perf, security-csp
`{apps,packages}/**`, seo-geo, nextjs-app-router `apps/web/**`) + les numérotées `alwaysApply:false` à
globs larges (10/12/30/40/41 sur `apps/web/**`, 31 sur `*hotel*`) → **un seul fichier de fiche hôtel
déclenche ~12 MDC**. Pas une erreur, mais une charge contexte notable.

**D — Liens internes**
- ✅ Tous les `ADR-XXXX` cités résolvent vers un fichier `docs/adr/XXXX-*.md` (0004, 0007, 0008, 0009,
  0011, 0019, 0020, 0021, 0024, 0025 présents).
- ⚠️ `nextjs-app-router.mdc` L70 : « ADR-0004 for the layout decision » — le fichier `0004-algolia.md`
  existe mais traite d'**Algolia**, pas du layout (mismatch sémantique). → **P3**.
- ⚠️ `photo-quality.mdc` : référence corps `packages/ui/src/cloudinary.ts` → `buildCloudinarySrc`, chemin
  périmé (cf. driver B). → **P3**.
- ✅ `12-schema-ota.mdc` L23 : les 8 builders cités (`hotel, faq, breadcrumb, article, item-list,
  aggregate-rating, place-amenity, video-object`) existent tous dans `packages/seo/src/jsonld/`. L24
  (« pas de builder `image.ts` dédié ») confirmé : aucun `image.ts` présent.

**E — Contradictions keywords**
- ❌ `31-hotel-page-blueprint.mdc` : **contradiction interne** (verbatim §5).
- ✅ `force-dynamic` / `ISR` / `revalidate` / `nonce` : cohérents post-Vague F entre `seo-geo`,
  `nextjs-app-router`, `hotel-detail-page` (force-dynamic aujourd'hui = transitoire nonce CSP / ISR 3600 = cible ADR-0007).
- ✅ `unsafe-inline` / `unsafe-hashes` : `security-csp` interdit `unsafe-inline` sur `script-src` ; aucun MDC ne le contredit.
- ✅ Gel `Offer` Phase 6 : `12-schema-ota` + `31` alignés.

**F — Hygiène**
- ✅ EOL : 100 % LF (`git ls-files --eol`).
- ⚠️ Trailing whitespace : `10-seo-foundations.mdc` (1 ligne), `itinerary-page.mdc` (5 lignes), `seo-geo.mdc` (1 ligne). → **P3** cosmétique.
- ℹ️ `seo-geo.mdc` L160 contient `// TODO: native-seo-review` : ce n'est **pas** un TODO orphelin du MDC,
  c'est une **consigne documentée** (marquer les traductions provisoires dans `messages/`). Non bloquant.

---

## 4. N2 — Scénarios générés

26 fichiers dans [`docs/audits/mdc-test-scenarios/`](mdc-test-scenarios/), 1 par MDC. Chacun contient :
identité, prompt **positif**, critères d'acceptation, prompt **négatif**, statut.

| MDC | Fichier scénario | Statut |
|-----|------------------|--------|
| 01-project-overview | [01-project-overview.md](mdc-test-scenarios/01-project-overview.md) | ⏸ pending manual run |
| 10-seo-foundations | [10-seo-foundations.md](mdc-test-scenarios/10-seo-foundations.md) | ⏸ pending manual run |
| 11-seo-multilingue | [11-seo-multilingue.md](mdc-test-scenarios/11-seo-multilingue.md) | ⏸ pending manual run |
| 12-schema-ota | [12-schema-ota.md](mdc-test-scenarios/12-schema-ota.md) | ⏸ pending manual run |
| 14-agent-routing | [14-agent-routing.md](mdc-test-scenarios/14-agent-routing.md) | ⏸ pending manual run |
| 20-agents-overview | [20-agents-overview.md](mdc-test-scenarios/20-agents-overview.md) | ⏸ pending manual run |
| 30-programmatic-pages | [30-programmatic-pages.md](mdc-test-scenarios/30-programmatic-pages.md) | ⏸ pending manual run |
| 31-hotel-page-blueprint | [31-hotel-page-blueprint.md](mdc-test-scenarios/31-hotel-page-blueprint.md) | ⏸ pending manual run |
| 40-llms-txt-strategy | [40-llms-txt-strategy.md](mdc-test-scenarios/40-llms-txt-strategy.md) | ⏸ pending manual run |
| 41-robots-agents-permissions | [41-robots-agents-permissions.md](mdc-test-scenarios/41-robots-agents-permissions.md) | ⏸ pending manual run |
| architecture-layers | [architecture-layers.md](mdc-test-scenarios/architecture-layers.md) | ⏸ pending manual run |
| code-conventions | [code-conventions.md](mdc-test-scenarios/code-conventions.md) | ⏸ pending manual run |
| commit-conventions | [commit-conventions.md](mdc-test-scenarios/commit-conventions.md) | ⏸ pending manual run |
| e2e-testing | [e2e-testing.md](mdc-test-scenarios/e2e-testing.md) | ⏸ pending manual run |
| editorial-voice | [editorial-voice.md](mdc-test-scenarios/editorial-voice.md) | ⏸ pending manual run |
| hotel-detail-page | [hotel-detail-page.md](mdc-test-scenarios/hotel-detail-page.md) | ⏸ pending manual run |
| integrations-api | [integrations-api.md](mdc-test-scenarios/integrations-api.md) | ⏸ pending manual run |
| itinerary-page | [itinerary-page.md](mdc-test-scenarios/itinerary-page.md) | ⏸ pending manual run |
| nextjs-app-router | [nextjs-app-router.md](mdc-test-scenarios/nextjs-app-router.md) | ⏸ pending manual run |
| observability-perf | [observability-perf.md](mdc-test-scenarios/observability-perf.md) | ⏸ pending manual run |
| photo-quality | [photo-quality.md](mdc-test-scenarios/photo-quality.md) | ⏸ pending manual run |
| security-csp | [security-csp.md](mdc-test-scenarios/security-csp.md) | ⏸ pending manual run |
| seo-geo | [seo-geo.md](mdc-test-scenarios/seo-geo.md) | ⏸ pending manual run |
| skills-capitalisation | [skills-capitalisation.md](mdc-test-scenarios/skills-capitalisation.md) | ⏸ pending manual run |
| supabase-rls | [supabase-rls.md](mdc-test-scenarios/supabase-rls.md) | ⏸ pending manual run |
| user-acceptance-before-commit | [user-acceptance-before-commit.md](mdc-test-scenarios/user-acceptance-before-commit.md) | ⏸ pending manual run |

> **Méthode N2 = statique.** Génération de scénarios + critères uniquement. Aucune exécution agent n'a
> été lancée (aucune simulation interne marquée « simulation » : tout est `⏸ pending manual run` pour
> rester honnête sur ce qui a réellement été vérifié). Les scénarios sont conçus pour être rejoués un
> par un par un humain ou un agent de test dédié.

---

## 5. Contradictions détectées

### C-1 (P2) — `31-hotel-page-blueprint.mdc` : ADR-0024 vs ADR-0025 (interne)

- **L23** :
  > « `hotel-detail-page.mdc` est la **source autoritaire** […]. Note : la décision « fiche éditoriale
  > d'abord » vit dans **ADR-0025**, pas ADR-0024 (qui concerne le transform photo signature). »
- **L82** :
  > « la fiche principale (`hotel/[slug]/page.tsx`) ne fetch aucune offre **(ADR-0024)** ; »

Le « no-offer-fetch » est une conséquence directe de la décision éditorial-first, attribuée à **ADR-0025**
en L23 mais à **ADR-0024** en L82, dans le **même fichier**. L'agent qui suit L82 citera le mauvais ADR.

**Reco résolution** (à faire en Vague F-bis, hors de cette PR détection-only) : remplacer `(ADR-0024)`
par `(ADR-0025)` à L82. 1 caractère de fond, cohérent avec `nextjs-app-router.mdc` L18 et
`hotel-detail-page.mdc` L91 qui citent déjà correctement ADR-0025.

### C-2 (P3) — `nextjs-app-router.mdc` L70 : pointeur ADR-0004 hors-sujet

- **L70** : « See […] and **ADR-0004** for the layout decision. »
- `docs/adr/0004-algolia.md` traite d'Algolia, pas du layout de dossiers.

**Reco résolution** : vérifier l'ADR layout réel (probablement ADR-0002 monorepo, ou aucun ADR dédié) et
corriger le pointeur, ou retirer la mention. Non bloquant.

> Aucune contradiction **inter-MDC** sur les keywords sensibles (force-dynamic / ISR / nonce / unsafe-inline /
> Offer / hreflang / editorial-first) : la Vague F a aligné `seo-geo`, `nextjs-app-router`, `hotel-detail-page`.
> La seule contradiction est **intra-fichier** (C-1).

---

## 6. MDC orphelines

**Aucune MDC entièrement orpheline.** Toutes les MDC à globs matchent ≥ 1 fichier réel.

Cas particuliers à documenter :

- **Règles sans globs** (par design, pas orphelines) :
  - `alwaysApply:true` → toujours chargées : `editorial-voice`, `skills-capitalisation`, `user-acceptance-before-commit`.
  - `alwaysApply:false` + pas de globs → **manuelles / déclenchées par description** : `01-project-overview`,
    `14-agent-routing`, `20-agents-overview`, `commit-conventions`. C'est l'effet recherché par la Vague A
    (ne pas consommer du contexte en permanence). **Action : aucune** — comportement voulu.
- **Segment de glob mort** (pas la MDC entière) : `photo-quality.mdc` → `packages/ui/src/cloudinary.ts`
  (réel `cloudinary-presets.ts`). **Action : corriger le chemin** en Vague F-bis (P3).

---

## 7. Trajectoire post-audit

| Prio | Action | Vague | Type |
|------|--------|-------|------|
| **P1** | — (aucun) | — | — |
| **P2** | Corriger `31-hotel-page-blueprint.mdc` L82 `(ADR-0024)` → `(ADR-0025)` | **Vague F-bis SÉPARÉE** (modifie MDC) | correction immédiate |
| **P2** | Arbitrer l'overlap globs : restreindre les globs des numérotées 10/12/30/40/41, OU les passer manuelles (pas de globs) comme 01/14/20 | prochaine vague (décision archi) | backlog |
| **P3** | Corriger chemin `cloudinary.ts` → `cloudinary-presets.ts` dans `photo-quality.mdc` | Vague F-bis | correction |
| **P3** | Corriger / retirer le pointeur ADR-0004 dans `nextjs-app-router.mdc` L70 | Vague F-bis | correction |
| **P3** | Nettoyer trailing whitespace (10-seo-foundations, itinerary-page, seo-geo) | Vague F-bis | hygiène |
| **P3** | Exécuter réellement les 26 scénarios N2 (run manuel ou agent de test) | prochaine vague | validation |

**Dette consciente assumée** : l'overlap de globs (P2 #2) est un choix de gouvernance (rules transverses
larges). Tant qu'il n'est pas arbitré, il reste documenté ici comme dette, pas comme bug.

> **Séparation détection / correction** : cette PR **ne corrige rien**. Les P2/P3 ci-dessus seront traités
> dans une **Vague F-bis distincte** (qui, elle, modifiera les `.mdc` — donc lèvera le gel détection-only).

---

## 8. Annexes

### Paths absolus des MDC

`C:\Users\benja\Projects\conciergetravel.fr\.cursor\rules\<nom>.mdc` (26 fichiers — cf. §2).

### ADR référencés (tous présents)

`docs/adr/` : 0004-algolia, 0007-isr-via-auth-client-island, 0008-url-structure-hotel-flat,
0009-hotel-room-subpages-indexable, 0011-concierge-voice, 0013-isr-vs-dynamic-csp-nonce,
0019-le-concierge-club-architecture, 0020-sea-member-pricing-constraints, 0021-pivot-scope-mondial,
0024-photo-signature-transform, 0025-booking-integration-last-brick, 0026-csp-rendering-strategy,
0027-csp-model-evolution.

### Méthodologie

1. **Inventaire** : `git ls-files .cursor/rules/` (26 MDC) + `Measure-Object -Line` (lignes).
2. **N1 lint** :
   - A — extraction front-matter via `Grep ^(description|globs|alwaysApply):`.
   - B — `git ls-files` ciblé sur chaque glob non trivial (itinéraire, photo-quality, jsonld).
   - C — matrice mentale des globs (familles `apps/web/**`, `{apps,packages}/**`, narrow).
   - D — `git ls-files docs/adr/` + résolution de chaque `ADR-XXXX` + `git ls-files` des code paths cités.
   - E — `Grep` keywords (force-dynamic, ISR, nonce, unsafe-*, Offer, editorial-first, ADR-0024/0025) + lecture ciblée.
   - F — `git ls-files --eol`, `Get-Content -match ' +$'`, `Select-String TODO|FIXME`.
3. **N2** : génération statique de scénarios (positif/négatif/critères) déduits du corps de chaque MDC.
4. **Honnêteté** : aucun chiffre inventé ; statuts N2 tous `⏸ pending manual run` (aucune exécution agent).

### Liens

- N2 scénarios : [`docs/audits/mdc-test-scenarios/`](mdc-test-scenarios/)
- Vague D (conformité fiches) : `docs/audits/2026-06-02-vague-d-fiches-hotels-conformity.md`
- Inventaire CSP G-1 : `docs/audits/2026-06-02-vague-g1-inline-inventory.md`
- ADR-0026 / ADR-0027 : `docs/adr/0026-csp-rendering-strategy.md`, `docs/adr/0027-csp-model-evolution.md`
