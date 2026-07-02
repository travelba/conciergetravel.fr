# Plan maître 90 jours — exécution multi-agents (Opus 4.8)

**Date** : 2026-07-02
**Auteur** : chef de projet (session d'audit 2026-07-02, soirée)
**Exécutant cible** : agents Cursor **Claude Opus 4.8**, lancés en parallèle
(jusqu'à 4-6 simultanés), chacun sur UN workstream borné.
**Supersède / englobe** :
`docs/audits/plan-execution-post-audit-2026-07-02.md` (7 vagues, repris ici
comme colonne vertébrale) + `docs/audits/dataseo-action-plan-2026-06-29.md`
(vagues P0-P4, jamais exécutées).

---

## 0. Diagnostic en 6 chiffres (preuves du 2026-07-02)

| Fait                                       | Mesure                                                            | Source                                  |
| ------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| Mots-clés classés Google FR                | **1** (pos. 21-30, ~0,7 visite/mois)                              | DataForSEO Labs live 02/07              |
| Idem yonder.fr                             | **14 727** kw, 616 en P1, ~418 k visites/mois                     | idem                                    |
| Pages avec impressions GSC                 | **191 / 8 202 (2,3 %)**                                           | `gsc-indexation-2026-06-29.md`          |
| Top 20 sur le panier de 12 requêtes cibles | **0 / 12**                                                        | `serp-baseline-2026-06-24.md`           |
| Intros EN de classements réelles           | ~~68/863~~ **863/863 (backfill fin juin, vérifié DB 02/07 soir)** | vérification SQL live (amendement WS-D) |
| Fiches conformes CDC photos (≥30, 10 cat.) | **~0,2 %**                                                        | grand audit fiches 29/06                |

Ce que Google indexe en priorité aujourd'hui : `/destination/dommeldange`
(1 hôtel), Belgrade, Clervaux, Holualoa — pendant que `le-meurice` est
« Discovered, not indexed ». **Le crawl budget part dans la longue traîne
vide.** Sur ma marche prod : espagnol résiduel dans les chambres du Gritti,
FAQ contradictoires (« 1 restaurant » vs 6 venues listées), Paris annoncé à
114 / 68 / 45 adresses selon la page, CTA « Réserver » grisé sur la
majorité du catalogue.

**Thèse du plan** : le contenu et la machine SEO sont prêts (supérieurs à
yonder). Les 4 goulots, dans l'ordre : (1) autorité ≈ 0, (2) crawl gaspillé

- HTML jamais en cache, (3) finition/confiance (claims, EN stub, compteurs,
  CTA mort), (4) transactionnel inexistant. On ne produit **plus aucun
  contenu net nouveau** tant que ces goulots ne bougent pas — à une exception
  près : la matrice lexicale `hotel-de-luxe-*` / `luxury-hotels-*` (WS-D2).

---

## 1. Objectifs & KPIs (M+1 / M+3)

| KPI                                                  | Baseline 02/07           | Cible M+1           | Cible M+3                        |
| ---------------------------------------------------- | ------------------------ | ------------------- | -------------------------------- |
| Mots-clés classés FR (DataForSEO Labs)               | 1                        | ≥ 50                | ≥ 500                            |
| Pages avec impressions GSC                           | 191 (2,3 %)              | > 800 (10 %)        | > 2 500 (30 %)                   |
| Panier 12 requêtes cibles en top 20                  | 0/12                     | 0-1/12 (D4 reporté) | 4-6/12 (si D4 rouvert début M+2) |
| Backlinks référents (domaines)                       | ~0                       | 0-2 (D4 reporté)    | ≥ 15 (si D4 rouvert début M+2)   |
| TTFB fiche hôtel (cache HIT)                         | 3-4,5 s (MISS permanent) | < 800 ms            | < 500 ms                         |
| Intros EN classements réelles                        | 863/863 (vérifié 02/07)  | QA native 30 têtes  | QA 100 %                         |
| Claims Palace non sourcés                            | > 0 en prod              | 0                   | 0                                |
| Fiches top-100 marque à ≥ 20 photos / ≥ 6 catégories | ~0                       | 50                  | 100                              |
| CTA réservation mort (bouton disabled)               | majorité catalogue       | **0**               | 0                                |
| Demandes concierge / mois (funnel email)             | non mesuré               | mesuré + baseline   | ×2 vs M+1                        |

Mesure hebdomadaire obligatoire (WS-I) : le run `track-serp-positions.ts`

- export GSC + snapshot DataForSEO domain overview. Aucun KPI ne se pilote
  « au ressenti ».

---

## 2. Décisions PO — TRANCHÉES le 2026-07-02 (soirée)

| #   | Décision                           | Choix PO                                                                                                                                                            | Effet                                                                                                        |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1  | **Phase 6 / transactionnel**       | **(a) gel réel immédiat** (CTA universel = demande concierge, vendors coupés du rendu public) **puis (b) pilote booking Travelport 50-100 hôtels en semaines 7-12** | WS-E et WS-F démarrent avec l'hypothèse D1a actée ; WS-H confirmé pour S7 sous réserve du go/no-go de fin S4 |
| D2  | **Template fiche kit vs standard** | **Décision sur preuve** : WS-F livre le comparatif (LCP, mobile, lisibilité, 5 vs 5 fiches) en semaine 2, le PO tranche ensuite                                     | Aucun rollout du kit avant le comparatif                                                                     |
| D3  | **Surface indexable**              | **Coupe complète** : noindex + retrait sitemap des destinations < 3 hôtels, des 1 158 lieux et des rooms — réversible                                               | WS-B exécute l'option maximale                                                                               |
| D4  | **Autorité / outreach humain**     | **Reporté** — pas d'envoi/relance PO pour l'instant                                                                                                                 | ⚠ Voir l'encadré risque ci-dessous ; WS-A réduit au « pack prêt-à-tirer » + leviers 100 % agent              |
| D5  | **Cadence multi-agents**           | **5-6 agents simultanés au pic** (S2-S4), merge quotidien ordonné B → E → F → reste                                                                                 | Planning §6 inchangé                                                                                         |

### ⚠ Conséquence assumée de D4 (à relire à M+1)

L'outreach étant reporté, **le goulot n°1 (autorité) ne bougera presque
pas à M+1**. Concrètement :

- KPI « backlinks référents » : cible M+1 ramenée de ≥ 5 à **0-2**
  (opportunistes uniquement) ; « panier 12 requêtes en top 20 » : 2/12
  devient **0-1/12** à M+1. Les cibles M+3 ne tiennent que si l'outreach
  démarre au plus tard début M+2.
- Le plan maximise en compensation les leviers d'autorité **100 % agent**
  (WS-A réduit) : page badge auto-servie (les hôtels peuvent l'adopter
  sans outreach), données citables publiées, GEO/LLM (llms.txt, feeds,
  agent-skills — où MCH est déjà fort et où l'autorité classique compte
  moins), et le maillage interne (orphelins, hiérarchie de
  cannibalisation) qui est le seul « PageRank » qu'on contrôle.
- **Point de re-décision : fin de semaine 4** (re-audit global). Si les
  impressions GSC ne décollent pas malgré WS-B + WS-E, la cause probable
  restera l'autorité — la décision D4 devra être rouverte (engagement PO
  ou prestataire RP).

---

## 3. Brief commun — à coller en tête de CHAQUE prompt d'agent

> Copier-coller ce bloc verbatim au début de chaque mission. Il compense
> ce qu'un agent frais ne sait pas et neutralise les erreurs déjà payées.

```text
CONTEXTE COMMUN (obligatoire, ne pas dévier) :

- Repo : C:\Users\benja\Projects\conciergetravel.fr (monorepo pnpm/Turbo,
  Next.js 16, TypeScript strict, Supabase). Lis AGENTS.md en premier.
- Windows + PowerShell : utilise curl.exe (jamais l'alias curl), pas de
  heredoc bash, cf. .cursor/skills/windows-dev-environment/SKILL.md.
- DB : passe par PostgREST (NEXT_PUBLIC_SUPABASE_URL +
  SUPABASE_SERVICE_ROLE_KEY). Les scripts `pg` directs échouent sur cette
  machine (DNS IPv6). Les selects full-catalogue à colonnes lourdes
  timeout : pré-filtrer sur les slugs, puis --slugs=.
- HARD RULES : pas de `any`/`as`/`!` ; pas d'Offer JSON-LD ni de
  prix/dispo live (Phase 6) sauf mission explicite ; pas de PII en logs ;
  migrations forward-only ; i18n keys, pas de strings en dur.
- CONTENU : tout texte généré passe le gate hasLeak()
  (scripts/editorial-pilot/src/enrichment/scaffolding-gate.ts) AVANT
  persistance, et toute génération est DataForSEO-grounded
  (groundHotel/groundKeywords, cache data/dfs-cache/). Dry-run d'abord,
  toujours. Lots de 20-30 entités max, re-audit après chaque lot.
- ACCEPTANCE : avant tout commit d'un changement user-visible, marche la
  page comme un utilisateur réel (prod ou preview, curl si pas de
  navigateur) FR + EN, et rapporte URLs + preuves. Règle
  .cursor/rules/user-acceptance-before-commit.mdc.
- GIT : une branche dédiée à ta mission (nom fourni dans le brief), petits
  commits Conventional Commits, JAMAIS de push sur main. Ne touche à AUCUN
  fichier hors de ta zone d'écriture déclarée (section 4 du plan maître).
- Si tu rencontres une décision de gouvernance (Phase 6, indexabilité,
  suppression de données), STOP et remonte au PO. Tu ne trances pas.
- Fin de tâche : rapport = ce qui a été fait / preuves / gaps restants +
  la mini-table de progression AGENTS.md §4ter.
```

---

## 4. Cartographie de parallélisation

### 4.1 Les 9 workstreams et leurs zones d'écriture (disjointes)

La règle absolue du multi-agents : **deux agents n'écrivent jamais dans la
même zone**. Zones = chemins de fichiers + tables/colonnes DB.

| WS  | Nom                                  | Zone code (écriture)                                                                                                                                        | Zone DB (écriture)                                                                      | Parallélisable avec                          |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| A   | Autorité & offsite                   | `docs/marketing/**` (livrables)                                                                                                                             | —                                                                                       | tous                                         |
| B   | Crawl & indexation                   | `apps/web/src/app/sitemaps/**`, `apps/web/src/server/hotels/indexability.ts`, `robots.txt/route.ts`                                                         | —                                                                                       | tous sauf E (coord. sur routes)              |
| C   | P0 DataSEO (claims/meta/FAQ)         | `scripts/editorial-pilot/src/hotels/patch-dataseo-p0-*.ts`                                                                                                  | `hotels.{meta_title*, faq_content*, geo_qa, affiliations}` (lots slugs)                 | A, B, E, F, G                                |
| D   | Parité EN + matrice lexicale         | `scripts/editorial-pilot/src/rankings/**`                                                                                                                   | `editorial_rankings.{intro_en, editorial_sections EN, faq EN}`, nouvelles rows rankings | A, B, E, F, G (PAS C sur mêmes slugs hôtels) |
| E   | Performance & rendu                  | `apps/web/src/lib/security/csp.ts`, `proxy.ts`, `apps/web/src/app/[locale]/{hotel,destination,classement,lieux}/**/page.tsx` (rendu seul), `next.config.ts` | —                                                                                       | A, C, D, G                                   |
| F   | Front finition & UX transactionnelle | `apps/web/src/components/{search,hotel/booking-*,home}/**`, `apps/web/src/app/[locale]/recherche/**`, `catalogue-stats.ts`                                  | —                                                                                       | A, B, C, D, G                                |
| G   | Photos top-100                       | `scripts/editorial-pilot/src/photos/**`                                                                                                                     | `hotels.gallery_images` (lots slugs)                                                    | tous                                         |
| H   | Pilote transactionnel (post-D1b)     | `apps/web/src/app/[locale]/reservation/**`, `packages/integrations/travelport/**`                                                                           | tables booking                                                                          | démarre semaine 7, coord. avec F             |
| I   | Mesure & reporting                   | `scripts/editorial-pilot/src/grounding/track-serp-positions.ts`, `docs/audits/kpi-*.md`                                                                     | —                                                                                       | tous                                         |

**Conflits connus à arbitrer à la main** :

- C et D écrivent tous deux via LLM en DB : les lots de slugs doivent être
  **disjoints** (C = hôtels, D = rankings ; jamais le même runner en double).
- E et F touchent tous deux `apps/web` : E ne touche que le _mode de rendu_
  (export const, Suspense, CSP), F ne touche que les _composants_. Si un
  fichier page.tsx doit être modifié par les deux, F passe après E (rebase).
- B modifie `indexability.ts` que la fiche hôtel consomme : livraison B
  avant tout re-test SEO de C/D.

### 4.2 Mécanique multi-agents (Cursor)

- **1 agent = 1 mission = 1 branche** : `ws/<lettre>-<slug-court>`
  (ex. `ws/b-noindex-thin-destinations`). Pas de branche partagée.
- Lancer les agents longs (C, D, G) en **arrière-plan** ; garder 1 agent
  interactif pour E ou F (décisions de code plus fines).
- **Cadence d'intégration** : merge vers `main` 1×/jour maximum, dans
  l'ordre B → E → F → (C, D, G indifférent), après CI verte + walk.
- Les runners LLM batch (C, D, G) tournent en **terminal de fond** avec
  `--concurrency=3-4` et logs par lot ; l'agent surveille et re-audite,
  il ne « babysitte » pas chaque appel.
- Chaque agent termine par : rapport + re-audit + walk + PR. Le PO (ou
  l'agent chef d'orchestre) merge ; personne ne merge sa propre PR sans
  relecture croisée quand la zone touche `apps/web`.

---

## 5. Workstreams détaillés — briefs prêts à coller

Chaque brief suppose le bloc commun (§3) collé au-dessus.

---

### WS-A — Autorité & offsite (réduit par décision D4 — pack prêt-à-tirer)

**Pourquoi** : 1 kw classé vs 14 727 pour yonder. Rien d'on-page ne
compensera un profil de liens vide. **Décision D4 (02/07)** : l'outreach
humain (envoi/relance) est reporté — ce WS livre donc uniquement le pack
« prêt-à-tirer » + les leviers d'autorité 100 % agent, pour que le jour où
D4 est rouverte (au plus tard fin S4), l'exécution démarre en heures, pas
en semaines.

**Ce que fait l'agent (support)** :

1. **Badge « Sélectionné par MyConciergeHotel »** : concevoir la page
   `/le-concierge/badge` (FR/EN) + assets SVG (2 variantes) + snippet HTML
   d'intégration avec lien `dofollow` vers la fiche de l'hôtel. Cible :
   les 2 929 hôtels du catalogue = 2 929 backlinks potentiels depuis des
   domaines hôteliers à forte autorité.
2. **Kit presse enrichi** : à partir de `/presse/le-concierge-club`,
   produire un dossier « données citables » (les classements + l'API
   sources EEAT sont des aimants à citation journalistique) : 1 page par
   angle (Palaces 2026, ouvertures, tendances Venise/Paris), chiffres
   sourcés, contact presse.
3. **Liste de prospection** : générer un CSV de 200 cibles outreach
   (presse voyage FR/EN, blogs classés sur le panier de 12 requêtes —
   je les ai dans les SERP live —, offices de tourisme, associations
   IATA/APST, annuaires hôtellerie de luxe) avec angle personnalisé par
   cible. L'envoi est humain.
4. **Emails types** (FR/EN) pour 3 scénarios : hôtel (badge), journaliste
   (donnée exclusive), partenaire institutionnel.

**Ce que fait le PO (non délégable)** : envoyer, relancer, signer des
partenariats — **reporté par D4**. Le pack reste livré et prêt ; la page
badge est le seul levier qui peut générer des liens sans outreach (les
hôtels la découvrent via leur fiche).

**Acceptance** : page badge walkée FR/EN ; CSV 200 cibles livré ;
backlinks M+1 = opportunistes uniquement (0-2, cf. §2 D4).

**Prompt de lancement** :

```text
Mission WS-A (branche ws/a-authority-pack) : construis le pack autorité.
1) Nouvelle page /le-concierge/badge (fr+en, i18n keys, Server Component,
   JSON-LD WebPage) présentant le badge « Sélectionné par MyConciergeHotel »
   avec snippet HTML embed (lien dofollow vers la fiche hôtel du partenaire)
   + 2 SVG (clair/sombre) dans packages/ui/assets/.
2) docs/marketing/press-data-pack-2026-07.md : 4 angles citables avec
   chiffres exacts tirés de la DB (catalogue-stats.ts + requêtes PostgREST).
3) docs/marketing/outreach-targets-2026-07.csv : 200 cibles (presse voyage
   FR/EN, blogs présents dans les SERP « meilleurs hôtels {ville} »,
   offices de tourisme, annuaires luxe) avec colonne angle personnalisé.
4) docs/marketing/outreach-emails-2026-07.md : 3 templates FR+EN.
Zone d'écriture : apps/web (nouvelle route badge uniquement),
packages/ui/assets, docs/marketing. Walk fr+en avant PR.
```

---

### WS-B — Crawl & indexation sélective (J1-J5, 1 agent)

**Pourquoi** : Google indexe Dommeldange et Belgrade au lieu de Venise.
8 202 URLs soumises, 2,3 % avec impressions. Il faut concentrer le crawl
sur ~600-800 têtes.

**Tâches** :

1. **Noindex + retrait sitemap** des pages `/destination/<ville>` avec
   < 3 hôtels publiés (garder la page servie, honest empty-state déjà en
   place). Seuil dans une constante unique, testée.
2. **Retirer `places.xml` et `rooms.xml`** de l'index sitemap (les pages
   restent accessibles et maillées ; on les réintroduira quand l'autorité
   existera). Alternative moins agressive si le PO refuse : ne garder que
   les lieux des 20 villes têtes.
3. **Sitemap « head » prioritaire** : vérifier que `hotels.xml` et
   `rankings.xml` mettent `priority`/`lastmod` réels ; créer une section
   documentée des ~100 URLs têtes (classements villes volume, fiches
   flagship) pour soumission manuelle GSC.
4. **Cohérence gate** : `indexability.ts` (TS) et la RPC SQL 0078 doivent
   dériver du même prédicat (test de non-divergence — item 5.5 du plan
   post-audit).
5. **robots.txt** : corriger le disallow `/compte/` sans préfixe locale ;
   vérifier `/fr/` fantômes dans llms.txt (URLs canoniques sans préfixe).
6. Livrer au PO la **liste de soumission GSC** (30 URLs têtes, une par
   jour max en inspection d'URL) + resoumettre les 7 sitemaps.

**Acceptance** : diff des sitemaps avant/après (compte d'URLs par volet),
0 page tête retirée par erreur (échantillon 20 vérifié), tests verts,
walk d'une destination thin (noindex présent dans le HTML) et d'une tête
(index,follow).

**Prompt** :

```text
Mission WS-B (branche ws/b-crawl-focus) : réduis la surface indexable.
Décision PO D3 actée : noindex + retrait sitemap des destinations < 3
hôtels, retrait places.xml et rooms.xml de l'index sitemap. Fichiers :
apps/web/src/app/sitemaps/*.xml/route.ts, sitemap.xml/route.ts,
apps/web/src/server/hotels/indexability.ts (+ test non-divergence avec la
RPC SQL de la migration 0078), robots.txt/route.ts, llms.txt/route.ts
(URLs canoniques). Livrable additionnel :
docs/audits/gsc-submission-list-2026-07.md avec les 30 URLs têtes classées
par volume DataForSEO. Ne touche PAS aux composants de pages. Acceptance :
counts avant/après par sitemap, curl du meta robots sur 3 destinations
thin + 3 têtes, tests sitemaps verts.
```

---

### WS-C — Nettoyage P0 DataSEO (J1-J8, 1 agent + runners de fond)

**Pourquoi** : claims Palace non sourcés (Berkeley, Ritz, Burj Al Arab…),
meta titles cassés, FAQ FR/EN mélangées, PAA people, promesses booking
Phase 6 dans le contenu indexé. Poison EEAT + risque réglementaire agence
IATA. Le plan existe depuis le 29/06, **jamais lancé**.

**Tâches** (= Vagues 1-2 du plan DataSEO, reprises telles quelles) :

1. Terminer/committer `patch-dataseo-p0-hotels.ts` (déjà en cours, non
   commité — voir git status) avec `--dry-run` par défaut.
2. Lot 1 : les 10 fiches P0 (the-berkeley, hotel-de-russie,
   25hours-dubai, ritz-paris, claridge-s, bulgari-roma, burj-al-arab,
   jumeirah-mina-a-salam, trianon-palace, taj-lake-palace). Claims Palace :
   aligner sur la liste officielle Atout France juin 2026 (33 Palaces,
   tous en France — un hôtel hors France n'est JAMAIS « Palace » au sens
   label) ; sourcer ou retirer.
3. Lot 2 : les 20 fiches P0 suivantes + FAQ langue mélangée (le Gritti a
   de l'espagnol dans les noms de chambres → vérifier la source
   `rooms`/`faq`, corriger à la racine, pas au rendu).
4. Lot 3 : les 30 classements P0 (meta_desc hors bande, PAA bruitées,
   angles Phase 6).
5. Re-audit `dataseo:audit` sur chaque lot traité, avant/après.

**Garde-fous spécifiques** : ne JAMAIS régénérer un long texte dans ce WS
(corrections déterministes only) ; ne pas toucher aux entries curated ;
`hasLeak()` sur tout champ modifié.

**Acceptance** : rapport avant/après par lot ; 0 claim Palace non sourcé
sur les slugs traités ; walk FR+EN de 5 fiches et 3 classements corrigés.

**Prompt** :

```text
Mission WS-C (branche ws/c-dataseo-p0) : exécute les Vagues 1-2 du plan
docs/audits/dataseo-action-plan-2026-06-29.md (corrections déterministes
uniquement). Le runner scripts/editorial-pilot/src/hotels/
patch-dataseo-p0-hotels.ts est entamé (non commité) : finis-le, dry-run
par défaut, --apply explicite, logs par champ modifié. Traite par lots :
10 fiches P0, puis 20 fiches, puis 30 classements (listes dans le plan).
Spécifiquement : claims Palace → liste officielle Atout France 2026
(jamais de « Palace » hors France) ; FAQ/rooms avec langue mélangée
(espagnol détecté sur the-gritti-palace… : corrige la donnée source) ;
retrait PAA people et promesses booking/prix live. Interdit : régénérer
du long-form, toucher les entries curated. Après chaque lot : re-run
pnpm --filter @mch/editorial-pilot dataseo:audit sur les slugs, rapport
avant/après, walk FR+EN de 3 pages. Zone DB : hotels.{meta_*, faq_*,
geo_qa, affiliations} + editorial_rankings.{meta_desc_*, faq} sur les
slugs de tes lots uniquement.
```

---

### WS-D — Parité EN + matrice lexicale luxe (J2-J21, 1-2 agents)

> **AMENDEMENT 2026-07-02 22:55 (vérification DB post-baseline W27)** :
> la parité EN des classements a été **comblée fin juin** (backfill
> 23-29/06 non répercuté dans les audits) : 0 intro EN < 500 chars,
> 817/863 ≥ 2 000 chars, 7 579/7 579 justifications EN ≥ 200 chars,
> échantillons de qualité native. **D1 rétrécit à une passe de contrôle
> qualité + i18n (~1-2 j)** ; le gros du WS bascule sur D2 (matrice
> lexicale + orphelins), qui devient la mission principale.

**Pourquoi** : l'EN fait déjà plus d'impressions que le FR avec un CTR de
0,18 %. Et le volume est sur « hôtel de luxe {ville} » / « luxury hotels
{city} » (10-30× le phrasé « meilleurs hôtels »), sous-couvert.

**Sous-missions (séquencées, un seul agent écrit dans editorial_rankings
à la fois)** :

**D1 (réduit) — contrôle qualité EN + i18n (J2-J4)**

1. i18n des chaînes hardcodées des pages classements
   (déterministe : `classement/[slug]` L544/743, `classements` L369,
   `[axe]/[valeur]` L355).
2. Audit qualité sur échantillon (30 classements têtes) : l'intro EN
   est-elle native (pas de calque FR, pas de leak, terminologie
   correcte) ? Ne régénérer QUE les échecs détectés, par lots de 20,
   gate `hasLeak()` + `dfs_paa_coverage`.
3. Question slug EN (`/en/classement/meilleurs-hotels-rome` garde le
   slug FR) : instruire une reco chiffrée (volume « best hotels rome »
   vs coût redirects) pour décision PO — ne rien migrer sans décision.

**D2 — Matrice lexicale luxe (J8-J21)**

1. Étendre `combinator.ts` : slugs `hotel-de-luxe-{ville}` FR sur toutes
   les villes à volume (grounded, gate inventaire ≥ 3-4 hôtels) +
   réorienter titles/H1 EN sur « luxury hotels {city} ».
2. Les 12 destinations gap yonder (Vienne, Crète, Lisbonne, Seychelles…)
   si inventaire suffisant.
3. **Anti-cannibalisation** : pour chaque ville, désigner la page pilier
   (`hotel-de-luxe-X` ou `meilleurs-hotels-X` selon volume) et mailler
   les pages sœurs vers elle (lien « voir aussi » systématique + choix
   du H1). Documenter la hiérarchie dans un md.
4. Intégrer les **826 hôtels orphelins** (59 à Paris) dans ≥ 1 classement
   chacun via la matrice — c'est du PageRank interne gratuit.

**Acceptance** : échantillon 10 pages EN walkées (0 FR résiduel) ;
`dfs_paa_coverage` ≥ baseline sur chaque lot ; hiérarchie de
cannibalisation documentée ; orphelins Paris = 0.

**Prompt (D1)** :

```text
Mission WS-D1 (branche ws/d1-en-rankings) : parité EN des classements.
Étape 0 (déterministe) : i18n les chaînes hardcodées des pages classements
(fichiers/lignes listés dans docs/audits/plan-execution-post-audit-
2026-07-02.md §Vague 2.4). Étape 1 : construis la liste des 100 classements
têtes par volume (groundKeywords / cache data/dfs-cache/), puis régénère
intro_en (EN natif, voix Concierge, EDITORIAL_VOICE.md, jamais une
traduction littérale), justifications EN, sections EN — lots de 50,
4 sections/call max, hasLeak() sur chaque sortie, dfs_paa_coverage logué,
--dry-run d'abord. Réutilise les patterns de translate-sections-en.ts
(salvage par phrase plutôt que drop, floors Zod min(10) pas min(80)).
Zone DB : editorial_rankings colonnes EN uniquement. Ne touche pas aux
colonnes FR ni aux entries. Walk 5 pages /en/classement/* avant chaque PR.
```

---

### WS-E — Performance & rendu (J3-J21, 1 agent senior)

**Pourquoi** : tout le HTML public est `force-dynamic` (verrou CSP nonce)
→ zéro cache CDN, TTFB 3-4,5 s sur fiche, 1 MB de HTML, ~490-506 KB de JS
(budget 180). C'est un frein crawl ET UX. Le déverrouillage racine est une
décision d'architecture (ADR), pas un tuning.

**Tâches** :

1. **ADR CSP hash-based** (`docs/adr/00xx-csp-hash-isr.md`) : stratégie
   hash pour les scripts statiques par build + nonce conservé uniquement
   sur les routes authentifiées (`/compte`, `/reservation`). C'est le
   prérequis de tout le reste. Étendre `csp.test.ts`.
2. **Réactiver l'ISR** (`revalidate = 3600`) sur `/hotel/[slug]`,
   `/destination/[citySlug]`, `/classement/[slug]`, `/lieux/**` ;
   l'invalidation `revalidateTag` existe déjà.
3. **Sortir les vendors du chemin de rendu** (conditionné à D1a) :
   le HTML de la fiche ne dépend plus d'un appel Amadeus/Travelport.
4. **`/hotels` 10,4 Mo → < 500 Ko** : pagination par pays/ville.
5. **loading.tsx / error.tsx** sur les segments fiche/destination/
   classement.
6. **Budget JS** : passe `pnpm --filter @mch/web analyze`, couper les 2-3
   plus gros îlots clients non critiques (`dynamic(..., { ssr: false })`).
7. Script de mesure réutilisable : TTFB p50/p95 sur 20 URLs +
   `x-vercel-cache` ratio, avant/après, commité dans `scripts/perf/`.

**Acceptance** : `x-vercel-cache: HIT` au 2e hit fiche + destination ;
TTFB < 800 ms en HIT ; CSP sans `unsafe-inline` (tests) ; walk complet
FR+EN desktop+mobile après bascule ISR (c'est un changement de rendu
site-wide — la règle acceptance s'applique au maximum ici).

**Prompt** :

```text
Mission WS-E (branche ws/e-isr-csp) : rends le HTML cacheable.
1) Rédige docs/adr/00xx-csp-hash-isr.md : migration CSP nonce → hash pour
   les routes publiques (nonce conservé sur routes auth). Lis d'abord
   apps/web/src/lib/security/csp.ts, proxy.ts, ADR-0031, et
   .cursor/rules/security-csp.mdc (interdits : unsafe-inline/unsafe-eval).
2) Implémente, étends csp.test.ts, puis réactive revalidate=3600 sur
   hotel/[slug], destination/[citySlug], classement/[slug], lieux/**.
3) Décision PO D1a actée : retire les appels Amadeus sentiment +
   Travelport du chemin de rendu public (prepare-hotel-booking-rail.ts) —
   le rail devient purement éditorial + demande concierge.
4) Pagine /hotels (10,4 Mo → <500 Ko). 5) loading.tsx/error.tsx sur les
   segments cités. 6) scripts/perf/measure-ttfb.mjs : 20 URLs, p50/p95,
   x-vercel-cache, avant/après. Zone : uniquement les fichiers de rendu et
   sécurité listés — ne modifie AUCUN composant UI (zone WS-F). Acceptance
   stricte : tests CSP verts, HIT au 2e hit, walk fr+en desktop+mobile.
```

---

### WS-F — Front : finition « Booking-grade » + CTA universel (J3-J14, 1 agent)

**Pourquoi** : les incohérences visibles détruisent la confiance
transactionnelle (compteurs 114/68/45, FAQ contradictoires, recherche sans
photos, CTA grisé). Booking gagne sur la fiabilité perçue.

**Tâches** :

1. **CTA universel** (post-D1a) : supprimer `BookingComingSoon` (bouton
   disabled) partout ; tout hôtel non-bookable affiche le formulaire
   dates → `/reservation/start` (demande concierge email, funnel déjà
   live pour `display_only`/`email`). Un CTA mort = interdit.
2. **Recherche avec photos** : ajouter `hero_public_id` (+ ville, tier)
   à l'index Algolia (script de réindexation dans
   `scripts/`/`search-engineering` skill), afficher la photo Cloudinary
   dans `search-hotel-card.tsx` (fallback monogramme conservé). Exploiter
   les dates saisies (les passer au CTA demande concierge).
3. **Compteurs cohérents** : une seule source de vérité runtime pour
   « X adresses à {ville} » (requête count PostgREST cachée, pas 3
   constantes divergentes) ; corriger la home (« French Riviera — 3
   addresses » avec 68+ hôtels côte d'Azur en base = bug de mapping
   région).
4. **FAQ contradictoires** : sur la fiche, si `restaurants[]` est rendu,
   la FAQ « combien de restaurants » doit dériver du même champ (petit
   résolveur de cohérence côté rendu ou nettoyage data ciblé — coordonner
   avec WS-C pour la partie data).
5. **Double chrome homepage** : corriger le bug documenté dans
   `conditional-site-chrome.tsx`.
6. **Walk comparatif kit vs standard** (input décision D2) : 5 fiches
   kit vs 5 standard, LCP + lisibilité + snapshot mobile, rapport.

**Acceptance** : plus aucun bouton disabled sur le catalogue (grep +
walk 5 fiches de booking_mode différents) ; recherche avec photos walkée ;
compteurs identiques home/recherche/destination sur 3 villes testées.

**Prompt** :

```text
Mission WS-F (branche ws/f-front-finition) : finition transactionnelle.
1) Décision PO D1a actée : remplace BookingComingSoon (components/hotel/
   booking-slot.tsx et booking-coming-soon.tsx) par le formulaire demande
   concierge (dates → /reservation/start) pour TOUT booking_mode non live.
   Aucun CTA disabled ne doit subsister.
2) Photos dans la recherche : ajoute hero à l'index Algolia (réindexation
   idempotente, skill .cursor/skills/search-engineering/SKILL.md), affiche
   HotelImage dans components/search/search-hotel-card.tsx.
3) Compteurs : source unique runtime pour les counts ville/région
   (PostgREST + unstable_cache), remplace les constantes divergentes ;
   corrige le mapping « French Riviera » de la home.
4) Fiche : la FAQ « combien de restaurants » et le bloc restaurants
   doivent dériver du même champ — résolveur de cohérence au rendu.
5) Corrige le double chrome homepage (conditional-site-chrome.tsx).
6) Rapport comparatif kit vs standard (5 vs 5 fiches, LCP + mobile) pour
   la décision D2 — ne généralise RIEN sans cette décision.
Zone : components/{search,hotel,home}, recherche/, catalogue-stats et
lib associées. Ne touche pas au mode de rendu des pages (zone WS-E).
Walk fr+en desktop+mobile sur chaque changement.
```

---

### WS-G — Photos top-100 (J5-J30, 1 agent + runners)

**Pourquoi** : 0,2 % du catalogue au CDC (30 photos/10 catégories) ; face
à Booking, l'image est le premier signal de confiance. On ne fait PAS tout
le catalogue — on fait les 100 fiches à plus fort volume de marque
(celles du plan DataSEO : Ritz, Claridge's, George V, Burj Al Arab…).

**Tâches** :

1. Extraire la liste top-100 (volume marque DataForSEO × présence dans
   les classements têtes).
2. Pour chacune : sourcing Google Places (APPEND, pipeline existant) +
   official site via Tavily quand Places est épuisé ; viser ≥ 20 photos
   et ≥ 6 catégories (chambre, restaurant, spa, piscine, extérieur, vue).
3. Vision batch (`categorize-with-vision`) : alt FR/EN + catégorie +
   caption sur tout upload.
4. Zéro hotlink fournisseur (leçons photo-pipeline : pas d'URL
   `place-photos` brute en prod).
5. Rapport de couverture par fiche avant/après.

**Acceptance** : 50 fiches ≥ 20 photos/6 catégories à M+1 ; walk de
5 galeries (lightbox, alt enrichis, LCP hero priority).

**Prompt** :

```text
Mission WS-G (branche ws/g-photos-top100) : photos des 100 fiches têtes.
Lis .cursor/skills/photo-pipeline/SKILL.md d'abord. 1) Construis la liste
top-100 (croisement volume marque DataForSEO + classements têtes ; les 10
premières = celles de docs/audits/dataseo-action-plan-2026-06-29.md §5).
2) Sourcing Google Places APPEND (pipeline existant) puis Tavily/site
officiel en complément ; cible ≥20 photos / ≥6 catégories par fiche.
3) Vision batch pour alt_fr/alt_en/category/caption. 4) Aucun hotlink
fournisseur : tout passe par Cloudinary cct/hotels/. Lots de 20 fiches,
rapport de couverture avant/après par lot, walk de 2 galeries par lot.
Zone DB : hotels.gallery_images sur tes slugs uniquement.
```

---

### WS-H — Pilote transactionnel (semaines 7-12, conditionné à D1b)

**Pourquoi** : « aussi bon que Booking sur le transactionnel » exige à
terme prix + dispo + paiement. Le gel « dernière brique » intégral n'est
pas tenable si l'ambition est transactionnelle — mais on ne dégèle pas
tout : on pilote sur un sous-ensemble.

**Cadrage (à valider par ADR avant toute ligne de code)** :

1. Périmètre : 50-100 hôtels GDS-bookables (sandbox Travelport existant,
   `TRAVELPORT_SANDBOX_ENABLED`), FR d'abord.
2. Funnel : fiche → chambres live → invité → récap → paiement (le stub
   `confirmStubAction` devient un vrai provider — Amadeus Payments ou
   Stripe selon ADR).
3. Les hard rules CDC restent : pas d'indicateurs d'urgence fabriqués,
   `Offer.priceValidUntil` obligatoire dès qu'un Offer JSON-LD est émis,
   prix TTC en euros.
4. Mesure : taux de conversion fiche → demande vs fiche → booking sur le
   périmètre pilote, avant d'étendre.

**Ne démarre pas avant** : D1 tranché en (b), WS-E livré (le funnel ne
doit pas hériter du TTFB actuel), WS-F livré (CTA universel en place
comme fallback).

---

### WS-I — Mesure & reporting (hebdo, agent léger)

**Tâches** :

1. Run hebdo : `track-serp-positions.ts` (panier 12 requêtes + 20
   requêtes têtes), snapshot DataForSEO domain overview (MCH + yonder),
   export GSC (impressions, pages avec impressions, couverture).
2. Tableau de bord : `docs/audits/kpi-weekly-2026-Wxx.md` — la table KPI
   du §1 remplie, tendance sur 4 semaines, alertes (KPI qui régresse).
3. Re-audit DataSEO mensuel (100 hôtels + 100 classements) pour mesurer
   la dette restante.

**Prompt** :

```text
Mission WS-I (branche ws/i-kpi-weekly, récurrente) : produis le rapport
KPI hebdo docs/audits/kpi-weekly-2026-Wxx.md. Sources : scripts/
editorial-pilot/src/grounding/track-serp-positions.ts (panier de requêtes
dans le script), MCP DataForSEO domain_rank_overview sur myconciergehotel
.com ET yonder.fr (France/fr + US/en), export GSC fourni par le PO.
Remplis la table KPI du plan maître (docs/runbooks/master-plan-multi-
agent-2026-07.md §1), tendance 4 semaines, 3 alertes max, 3 recommandations
max. Lecture seule sur la DB. Pas de modification de contenu.
```

---

## 6. Planning 12 semaines (lanes parallèles)

```
Semaine  1 : décisions actées (02/07) │ WS-B ████ │ WS-C ████ │ WS-A pack ██ │ WS-I baseline █
Semaine  2 : WS-C ████ │ WS-D1 ████ │ WS-E (ADR+CSP) ████ │ WS-F ████ │ WS-A pack fin █
Semaine  3 : WS-D1 ████ │ WS-E (ISR+vendors) ████ │ WS-F ████ │ WS-G ████
Semaine  4 : WS-D2 ████ │ WS-E (/hotels+JS) ██ │ WS-G ████ │ re-audit global █
Semaines 5-6 : WS-D2 (matrice+orphelins) │ WS-G │ conformité pipelines (V5 du plan
              post-audit : grounding premium-sections, pino, dfs_paa_coverage en DB)
Semaines 7-9 : WS-H pilote transactionnel (si D1b) │ WS-G fin top-100 │ WS-D fond EN
Semaines 10-12 : WS-H élargi ou lead-gen optimisé │ V6 fond de panier │ bilan M+3
```

Charge agents : semaines 2-4 = pic à **5-6 agents simultanés**
(B fini, C+D1+E+F+G+A). Toujours ≤ 1 agent par zone d'écriture.

Jalons de merge (ordre quotidien) : B → E → F → C/D/G (indifférent).
Re-audit global fin de semaine 4 = décision go/no-go sur WS-H.

---

## 7. Gouvernance

- **Stand-up quotidien** (5 min, le PO ou l'agent orchestrateur) : chaque
  agent rapporte fait/bloqué/suivant + sa zone d'écriture du jour. Tout
  chevauchement de zone détecté = un des deux agents s'arrête.
- **Lots** : 20-30 entités max par écriture DB, dry-run systématique,
  re-audit après chaque lot, rollback snapshot avant tout `--apply`
  destructif (pattern `scaffold-removal-backup-*.json`).
- **Stop conditions** (tout agent s'arrête et remonte) : erreur API
  répétée ; réintroduction de scaffolding (`hasLeak` qui flambe) ;
  correction qui touche prix live/booking sans D1 ; KPI GSC qui chute
  brutalement après un merge (suspect n°1 : WS-B/WS-E).
- **Revue croisée** : toute PR touchant `apps/web` est relue par un agent
  différent de son auteur (bugbot subagent acceptable) avant merge.
- **Capitalisation** : chaque gotcha ≥ 2 itérations → skill
  (`.cursor/rules/skills-capitalisation.mdc`), sinon la leçon se repaie.
- **Rapport de fin de tâche** : mini-table de progression phases
  (AGENTS.md §4ter) obligatoire, hors-booking en premier.

## 8. Ce que ce plan ne fait PAS (assumé)

- Pas de génération de contenu net nouveau hors matrice lexicale D2
  (le corpus est suffisant ; le goulot est ailleurs).
- Pas de photo au-delà du top-100 avant M+2 (décision écrit-d'abord
  maintenue, ciblage au lieu du volume).
- Pas de locales V2 (DE/ES/IT) tant que l'EN n'est pas réparé.
- Pas de dégel Phase 6 intégral — uniquement le pilote borné WS-H si D1b.
- Pas de refonte design — le kit se décide sur preuve (D2), pas plus.
