# Inventaire de l'existant — garder · refondre · geler · supprimer

> Le seul document du dossier qui produit des suppressions. À valider par le PO
> avant exécution. Toutes les suppressions passent par une branche dédiée et un
> commit unique par catégorie, réversibles par `git revert`.

## Les quatre verdicts

| Verdict       | Signification                                                                            | Réversible ?                       |
| ------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| **GARDER**    | Actif de valeur, aucune action                                                           | —                                  |
| **REFONDRE**  | On garde la fonction, on refait ou on finit l'implémentation                             | —                                  |
| **GELER**     | Reste en place et fonctionnel, mais plus aucun investissement ; souvent mis en `noindex` | Oui, par simple décision           |
| **SUPPRIMER** | Sort du dépôt (ou passe en `docs/_archive/`)                                             | Oui, par `git revert` ou l'archive |

Le principe qui gouverne les suppressions : **on ne supprime jamais du contenu
publié ni des données.** On supprime de l'outillage mort, des doublons, des
artefacts et de la documentation périmée — c'est-à-dire ce qui coûte du temps
d'agent sans produire de valeur.

---

## 1. Applications

### `apps/web` — 67 pages, 51 handlers d'API, 155 composants

| Élément                                                                                                                                        | Verdict       | Motif                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/hotel/[slug]`, `/destination/[citySlug]`, `/classement/[slug]`, `/classements/*`                                                             | **GARDER**    | Le cœur du produit retenu                                                                                             |
| `/guide/[citySlug]`, `/guides`                                                                                                                 | **GARDER**    | Périmètre retenu (A0-5)                                                                                               |
| `/le-concierge/*` (contact, FAQ, méthode, hôteliers, presse, badge, newsletter)                                                                | **GARDER**    | Confiance + E-E-A-T + capture de leads                                                                                |
| `/le-concierge-club`, `/presse/le-concierge-club`                                                                                              | **GARDER**    | Devient une mécanique de capture d'e-mails (D4), pas un produit payant                                                |
| `/compte/*`, `/recherche`, `/hotels`, `/hotels/[pays]/[ville]`                                                                                 | **GARDER**    | `/hotels` **REFONDRE** : 10,4 Mo de HTML, à paginer (lot B7)                                                          |
| **Guides pays codés en dur** (`guide/italie`, `/japon`, `/maroc`, `/suisse`, `/thailande`, `/maldives`, `/etats-unis`, `/emirats-arabes-unis`) | **REFONDRE**  | 8 routes statiques coexistant avec la route dynamique `guide/[citySlug]` — deux chemins pour la même chose (B8)       |
| `/lieux/*` (1 158 lieux)                                                                                                                       | **GELER**     | Vertical complet et fonctionnel, mais il consomme du budget de crawl sans convertir. `noindex`, plus d'investissement |
| `/itineraire/[slug]`, `/itineraires`                                                                                                           | **GELER**     | Idem — le pipeline existe, on ne l'alimente plus                                                                      |
| `/marque/[brandSlug]`, `/marques`, `/label/[facetSlug]`, `/categorie/[categorySlug]`                                                           | **GELER**     | Pages de facettes à faible intention, sources de cannibalisation                                                      |
| `/ouvertures`, `/inspiration`, `/le-conseil-du-concierge`                                                                                      | **GELER**     | À réévaluer à la porte D en fonction des impressions réelles                                                          |
| `/dev/logo-preview`, `/dev/photo-filter-preview`                                                                                               | **SUPPRIMER** | Routes de développement exposées en production                                                                        |
| `/reservation/*` (start, recap, payment, invite, confirmation, sandbox)                                                                        | **GELER**     | Le tunnel existe et sert la Phase E. Il ne doit être atteignable depuis aucun parcours public avant                   |
| `/le-concierge/reserver`                                                                                                                       | **REFONDRE**  | Devient le formulaire de demande concierge, cible du CTA universel (D1)                                               |
| `components/hotel/kit/*` **ou** son pendant legacy                                                                                             | **SUPPRIMER** | Deux templates de fiche concurrents. L'arbitrage A0-4 en tue un — celui qui perd sort du dépôt (B1)                   |
| `components/home/home-kit-header.tsx`, `home-kit-footer.tsx`                                                                                   | **REFONDRE**  | La home a son propre chrome, différent des pages intérieures : maillage réduit et taxonomie incohérente               |
| 61 composants `'use client'` sur 155                                                                                                           | **REFONDRE**  | Revue ciblée : breadcrumb client global, îlots d'auth. Non urgent, à traiter en B                                     |
| `apps/web/e2e/` — 29 specs                                                                                                                     | **GARDER**    | Filet de sécurité réel, à étendre plutôt qu'à refaire                                                                 |

### `apps/admin` — Payload CMS, 15 fichiers

**GELER.** Le back-office est minimal et n'est pas sur le chemin critique : la
production de contenu passe par les scripts, pas par l'interface. On le garde
fonctionnel, on n'y investit pas avant la Phase E (où il redevient utile pour
les opérations de réservation).

---

## 2. Packages

| Package                    | Verdict             | Détail                                                                                              |
| -------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/domain` (118 f.) | **GARDER**          | Pur, sans I/O, layering tenu. C'est le meilleur code du dépôt                                       |
| `packages/db` (78 migr.)   | **GARDER**          | 27 tables, ~115 policies RLS. Migrations forward-only — on n'y touche jamais rétroactivement        |
| `packages/seo` (43 f.)     | **GARDER**          | Le différenciateur du projet. **REFONDRE** uniquement `metadata.ts` (titres dupliqués, lot C6)      |
| `packages/ui`              | **GARDER**          | Design system + tokens                                                                              |
| `packages/config`          | **GARDER**          | ESLint / TS / Tailwind / env                                                                        |
| `packages/emails`          | **GARDER**          | 5 templates React Email — support direct du funnel de demande (D2)                                  |
| `packages/observability`   | **REFONDRE**        | Écrit, correct… et **jamais importé**. Les logs de production sont des `console.*`. À brancher (A7) |
| `packages/experiments`     | **GELER**           | Feature flags + expériences club. Utile, non prioritaire                                            |
| `packages/integrations`    | **voir ci-dessous** |                                                                                                     |

### `packages/integrations` — 20 vendors

| Vendor                                                                                         | Verdict    | Motif                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http`, `redis`                                                                                | **GARDER** | Socle transverse                                                                                                                                                                      |
| `dataforseo`                                                                                   | **GARDER** | Obligatoire — grounding de tout contenu (hard rule 8ter)                                                                                                                              |
| `algolia-admin`, `cloudinary`, `brevo`                                                         | **GARDER** | Recherche, images, e-mails : le trio opérationnel                                                                                                                                     |
| `google-places`, `wikimedia-commons`, `overpass`, `apify`                                      | **GARDER** | Sourcing factuel et photos                                                                                                                                                            |
| `amadeus`, `travelport`, `ratehawk`, `little-hotelier`, `little-emperors`, `supplier`, `giata` | **GELER**  | **Sept connecteurs de réservation pour zéro réservation.** Ils restent dans le dépôt (actifs de Phase E) mais sortent du chemin de rendu public. La Phase E n'en réactivera **qu'un** |
| `makcorps`, `getyourguide`                                                                     | **GELER**  | Comparateur de prix et activités — hors périmètre retenu                                                                                                                              |

> **Point dur.** L'audit du 2 juillet a établi que le flag `PHASE_6_BOOKING_ENABLED`
> ne gate en réalité que le JSON-LD `Offer` : Amadeus et Travelport sont appelés
> **dans le chemin de rendu** de fiches publiques alors que la phase est
> officiellement gelée. C'est à la fois une incohérence de gouvernance et une
> cause directe de lenteur. Le gel doit devenir réel (lot B, décision A0-1).

---

## 3. Scripts — 374 fichiers TypeScript

C'est le plus gros gisement de simplification du dépôt.

| Zone                                                                              | Fichiers | Verdict       | Motif                                                                                                                                                          |
| --------------------------------------------------------------------------------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/grounding/`                                                                  | 11       | **GARDER**    | Le grounding DataForSEO est une hard rule                                                                                                                      |
| `src/enrichment/` (dont `scaffolding-gate.ts`)                                    | 44       | **GARDER**    | Le gate `hasLeak()` est le garant qualité du corpus                                                                                                            |
| `src/quality/`, `src/i18n/`                                                       | 6        | **GARDER**    | Audit et parité linguistique                                                                                                                                   |
| `src/hotels/`                                                                     | 90       | **TRIER**     | Le plus gros dossier : outillage vivant mêlé à des one-shots historiques                                                                                       |
| `src/rankings/`, `src/guides/`                                                    | 57       | **TRIER**     | **Doublons v1/v2 avérés** : `generate-ranking.ts` + `generate-ranking-v2.ts`, `generate-guide.ts` + `generate-guide-v2.ts` — les v1 n'ont ni grounding ni gate |
| `src/photos/`                                                                     | 53       | **GELER**     | Réactivé en D9, ciblé sur ~150 fiches, pas en volume                                                                                                           |
| `src/places/`, `src/pois/`, `src/itineraries/`, `src/restaurants/`, `src/events/` | 35       | **GELER**     | Alimentent les verticales gelées                                                                                                                               |
| `src/booking/`                                                                    | 11       | **GELER**     | Phase E                                                                                                                                                        |
| `src/yonder/`, `src/showcase/`, `src/phaseC/`, `src/import/`, `src/geocode/`      | 23       | **SUPPRIMER** | One-shots de campagnes terminées, conservés dans l'historique Git                                                                                              |
| `src/global-sources/`, `src/search/`, `src/concierge/`                            | 36       | **TRIER**     |                                                                                                                                                                |

### Les 6 générateurs à retirer en priorité (lot B5)

Identifiés par l'audit du 2 juillet comme tournant **sans grounding DataForSEO
ni `hasLeak()`** — c'est-à-dire capables de réintroduire dans le corpus
exactement le scaffolding qu'on vient de nettoyer :

1. `src/hotels/premium-section-generator.ts` (Tavily seul)
2. `src/hotels/description-extend-generator.ts`
3. `src/concierge/run-humanizer-faq.ts`
4. `src/guides/generate-guide.ts` (v1 — la v2 existe et est conforme)
5. `src/rankings/generate-ranking.ts` (v1 — idem)
6. `src/rankings/meta-desc-generator.ts`

**Verdict : SUPPRIMER.** Un bandeau « deprecated » ne suffit pas — un agent
pressé lance ce qu'il trouve. La v2 conforme existe dans les deux cas qui
comptent.

**Cible : ~150 scripts**, chacun accompagné d'une ligne dans un index
`scripts/editorial-pilot/README.md`. Un script sans description est un script
à supprimer.

---

## 4. Documentation — 241 fichiers Markdown

| Zone                                                         | Fichiers | Verdict      | Détail                                                                                                                                                                     |
| ------------------------------------------------------------ | -------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/`                                                  | 33       | **GARDER**   | Mémoire des décisions. **Ne jamais supprimer un ADR** — on le marque _superseded_                                                                                          |
| `docs/00-*` → `docs/10-*`                                    | 11       | **GARDER**   | Documentation de référence, à réaligner sur ce cadrage                                                                                                                     |
| `docs/03-integrations/`                                      | 8        | **GARDER**   | Runbooks vendors                                                                                                                                                           |
| `docs/09-checklists/`                                        | 3        | **GARDER**   | Portes de qualité                                                                                                                                                          |
| `docs/audits/`                                               | 46       | **ARCHIVER** | Photographies datées de mai à juillet. Elles ont produit ce cadrage, elles n'ont plus à être lues                                                                          |
| `docs/runbooks/` (superseded)                                | ~8       | **ARCHIVER** | `roadmap-2026-06-v2`, `cap-editorial-close`, `overnight-*`, `master-plan-multi-agent-2026-07`, `PROJET-MASTER-PLAN` — remplacés par ce dossier, bandeau de renvoi (lot A5) |
| `docs/runbooks/` (vivants)                                   | ~5       | **GARDER**   | `vercel-setup`, `domain-migration`, `i18n-v2-rollout`, `airelles-reference-fiche-plan`                                                                                     |
| `docs/editorial/`, `docs/pilots/`, `docs/le-concierge-club/` | ~20      | **ARCHIVER** | Plans d'exécution de campagnes terminées                                                                                                                                   |
| `docs/marketing/`                                            | 5        | **GARDER**   | **Directement actionnable en D5** : pack presse, 200 cibles, modèles FR/EN                                                                                                 |
| `docs/legal/`                                                | 2        | **GARDER**   | CGV club, avenant hôtelier                                                                                                                                                 |
| `docs/design/`, `docs/audits/mdc-test-scenarios/`            | ~30      | **ARCHIVER** | Prompts Stitch et scénarios de test de règles                                                                                                                              |

**Cible : ~60 documents vivants, ~180 archivés.** L'archive reste dans le
dépôt sous `docs/_archive/`, lisible, avec un bandeau. On ne perd pas la
mémoire du projet — on cesse de la relire à chaque session.

---

## 5. Contexte agent — `AGENTS.md`, règles, skills

| Élément               | Actuel       | Cible | Verdict                                                                                                                                                                                                        |
| --------------------- | ------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`           | 1 139 lignes | ~250  | **REFONDRE** — garder les hard rules §4 et la table d'aiguillage §3 ; §4bis et §4ter (900 lignes d'historique de vagues) partent en archive, remplacés par un renvoi vers ce cadrage                           |
| `.cursor/rules/*.mdc` | 30           | ~15   | **REFONDRE** — ADR-0028 documente déjà le chevauchement de globs. Les règles des verticales gelées (`itinerary-page`, `hotel-kit-rollout` si le kit perd, `hotel-faq-perplexity`) sont fusionnées ou archivées |
| `.cursor/skills/`     | 48           | ~25   | **TRIER** — voir ci-dessous                                                                                                                                                                                    |

### Skills à retirer ou geler

| Skill                                                                                                       | Verdict        | Motif                                                                    |
| ----------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `mobile-app-expo`                                                                                           | **SUPPRIMER**  | Aucune application mobile, aucune prévue                                 |
| `whatsapp-concierge-journey`                                                                                | **SUPPRIMER**  | Canal jamais ouvert                                                      |
| `mcp-server-development`                                                                                    | **SUPPRIMER**  | Hors produit                                                             |
| `luxury-motion-effects`                                                                                     | **SUPPRIMER**  | Décoratif, non prioritaire                                               |
| `competitive-pricing-comparison`                                                                            | **GELER**      | Comparateur hors périmètre                                               |
| `amadeus-gds`, `little-hotelier`, `booking-engine`, `payment-orchestration`, `loyalty-program`              | **GELER**      | Phase E — utiles le jour venu                                            |
| `itinerary-editorial-pipeline`                                                                              | **GELER**      | Vertical gelé                                                            |
| `hotel-kit-rollout`                                                                                         | **selon A0-4** | Supprimé si le kit perd l'arbitrage                                      |
| `windows-dev-environment`                                                                                   | **GARDER**     | Le poste de développement est sous Windows — cette contrainte est réelle |
| `user-acceptance-loop`, `keyword-grounding-dataforseo`, `llm-output-robustness`, `concierge-voice-pipeline` | **GARDER**     | Les quatre skills qui portent la qualité du produit                      |

---

## 6. Artefacts binaires — ~36 Mo à sortir du dépôt

| Chemin             | Poids  | Verdict       | Motif                                                                                                                                               |
| ------------------ | ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DA/`              | 15 Mo  | **SUPPRIMER** | Quasi-doublon de `design/html-kit/` — vérifié : seuls `style.css`, `les-airelles-gordes.html` et `_generated/` diffèrent. On garde une seule source |
| `design/_compare/` | 8,6 Mo | **SUPPRIMER** | Captures de comparaison visuelle d'une campagne terminée                                                                                            |
| `design/stitch/`   | 13 Mo  | **SUPPRIMER** | Sorties de l'outil de design, non consommées par le code                                                                                            |
| `design/html-kit/` | 15 Mo  | **GARDER**    | Référence visuelle du kit — **sous réserve de l'arbitrage A0-4** : si le kit perd, il part aussi                                                    |

Ces fichiers ne sont importés par aucun code applicatif — ils sont consultés à
la main. Leur place est dans un espace de stockage partagé, pas dans l'historique
Git de chaque clone.

---

## 7. Base de données et contenu publié — aucune suppression

**Règle absolue : ce plan ne supprime aucune donnée.**

- Les 78 migrations sont _forward-only_ : on n'édite jamais une migration
  appliquée, on n'en réordonne jamais les fichiers.
- Les 2 219 fiches publiées, les 863 classements, les 1 158 lieux et les guides
  **restent en base**. Ce qui change pour les verticales gelées, c'est leur
  **indexabilité** (`noindex` + retrait des sitemaps, lot C8) — un signal
  réversible en une migration, pas une perte.
- Les corrections de contenu (Phase C) se font par lots de 20 à 30 entités, avec
  `--dry-run` systématique et snapshot avant tout `--apply` destructif
  (motif `scaffold-removal-backup-*.json` déjà en place).

---

## 8. Récapitulatif chiffré

| Dimension                      | Avant  | Après (cible) | Variation  |
| ------------------------------ | ------ | ------------- | ---------- |
| Poids d'artefacts versionnés   | ~51 Mo | ~15 Mo        | **−70 %**  |
| Scripts éditoriaux             | 374    | ~150          | **−60 %**  |
| Documents Markdown vivants     | 241    | ~60           | **−75 %**  |
| Lignes d'`AGENTS.md`           | 1 139  | ~250          | **−78 %**  |
| Règles `.mdc`                  | 30     | ~15           | **−50 %**  |
| Skills                         | 48     | ~25           | **−48 %**  |
| Verticales éditoriales actives | 7      | 3             | **−57 %**  |
| Templates de fiche             | 2      | 1             | **−50 %**  |
| Connecteurs actifs             | 7      | 0 (→ 1 en E)  | **−100 %** |
| **Pages publiées**             | —      | **inchangé**  | **0**      |
| **Données en base**            | —      | **inchangé**  | **0**      |

Les deux dernières lignes sont le point important : **on retire de la charge de
maintenance, pas de la valeur.**
