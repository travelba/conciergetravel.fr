# Playbook de remédiation post-audit — exécution parallèle par agents

**Date** : 2026-07-02
**Source** : `docs/audits/audit-complet-projet-2026-07-02.md` +
`docs/audits/plan-execution-post-audit-2026-07-02.md`
**Public** : agents IA exécutants (modèles économiques). Chaque Work
Package (WP) est **autonome** : contexte, fichiers, étapes, commandes,
critères d'acceptation, interdits. Un agent ne doit JAMAIS improviser
hors de son WP.

---

## 0. Règles d'orchestration (à lire par l'orchestrateur humain/IA)

### 0.1 Couloirs parallèles (lanes) — propriété exclusive des fichiers

| Lane                          | Périmètre fichiers (propriété EXCLUSIVE)                                                                                                                                                                      | Périmètre DB (écriture)                                                               | WPs        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| **A — Back/plateforme**       | `apps/web/src/server/**`, `apps/web/src/app/api/**`, `apps/web/src/lib/booking/**`                                                                                                                            | aucune                                                                                | A1, A2, A3 |
| **B — Front UI**              | `apps/web/src/app/[locale]/**` (pages), `apps/web/src/i18n/messages/*.json`, `apps/web/src/lib/seo/**`, `apps/web/src/components/layout/**`                                                                   | aucune                                                                                | B1→B6      |
| **C — Contenu DataSEO P0**    | `scripts/editorial-pilot/src/hotels/**`, `scripts/editorial-pilot/src/grounding/**`                                                                                                                           | table `hotels` (colonnes éditoriales)                                                 | C1, C2, C3 |
| **D — Parité EN classements** | `scripts/editorial-pilot/src/rankings/**`, `scripts/editorial-pilot/src/i18n/**`                                                                                                                              | tables `editorial_rankings`, `editorial_ranking_entries` (colonnes `*_en` UNIQUEMENT) | D1, D2, D3 |
| **E — Perf & crawl**          | `apps/web/src/lib/security/**`, `apps/web/src/proxy.ts`, `docs/adr/**`, `revalidate`/`dynamic` des pages                                                                                                      | aucune                                                                                | E1, E2, E3 |
| **F — Autorité & couverture** | `scripts/editorial-pilot/src/rankings/combinator.ts`, `scripts/editorial-pilot/src/enrichment/**`                                                                                                             | `editorial_rankings` (NOUVELLES rows), `hotels.external_sources`                      | F1, F2, F3 |
| **G — Conformité pipelines**  | `scripts/editorial-pilot/src/{hotels/premium-*,guides/generate-guide.ts,rankings/generate-ranking.ts,rankings/meta-desc-generator.ts,concierge/run-humanizer-faq.ts}`, `packages/db/migrations/` (1 nouvelle) | table de runs (nouvelle)                                                              | G1, G2, G3 |

**Collisions connues à arbitrer** :

- C et D écrivent en DB sur des tables différentes (C=hotels, D=rankings)
  → parallélisables. Si C doit toucher un classement (C3 copy Phase 6),
  il ne touche QUE les colonnes FR ; D ne touche QUE les colonnes `_en`.
- B et E touchent tous deux des `page.tsx` → E n'a le droit de modifier
  QUE les exports `dynamic`/`revalidate` + imports CSP ; B ne touche
  jamais ces exports. En cas de doute : B passe avant E sur un fichier.
- A2 (gel Phase 6) modifie `hotel/[slug]/page.tsx` (appels vendors) qui
  appartient aussi à B/E → A2 s'exécute EN PREMIER (Vague 0), avant que
  B et E ne démarrent sur ce fichier.

### 0.2 Git — protocole multi-agents

1. **Une branche par lane** : `fix/lane-a-platform`, `fix/lane-b-front`,
   `chore/lane-c-dataseo`, etc. PRs petites (1 WP = 1 à 3 commits max).
2. **Jamais `git add -A` / `git add .`** — toujours un pathspec explicite
   (règle skill `windows-dev-environment` §9 quinquies).
3. Conventional Commits (`.cursor/rules/commit-conventions.mdc`).
4. **Aucun commit sans walk-through** pour un changement user-visible
   (règle dure `.cursor/rules/user-acceptance-before-commit.mdc`) —
   le walk minimal accepté sur cette machine : curl du HTML + captures
   `npx --yes playwright@latest screenshot --browser=chromium …`
   (Chrome absent, voir skill `windows-dev-environment` §Rule 14).
5. Avant push : `pnpm turbo run typecheck` + tests du package touché.

### 0.3 Environnement (obligatoire avant tout WP script/DB)

- Lire `.cursor/skills/windows-dev-environment/SKILL.md` en entier.
- Scripts DB : passer par **PostgREST** (`NEXT_PUBLIC_SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`), JAMAIS `pg` direct (IPv6 KO sur la box).
- La vraie clé service-role (`eyJ…`, ~247 chars) est dans le
  `.env.local` **racine** — celle d'`apps/web/.env.local` est une clé
  publishable mal nommée : un write avec elle **no-op silencieusement**
  (HTTP 200, 0 row). Toujours vérifier `KEY.startsWith('eyJ')` et
  toujours relire une row après écriture.
- Toujours `--dry-run` d'abord quand le flag existe ; lots de 20-30
  entités max ; snapshot/rollback avant tout write destructif.

### 0.4 Interdits globaux (hard rules — un WP qui les viole est rejeté)

- Pas de `any`, `as Foo`, `!` non-null. Pas de `dangerouslySetInnerHTML`
  hors `JsonLdScript`. Pas de PII en logs.
- Pas d'`Offer`/`priceValidUntil` JSON-LD, pas de prix live, pas
  d'indicateur d'urgence (Phase 6 gelée).
- Tout texte généré par LLM passe `hasLeak()`
  (`scripts/editorial-pilot/src/enrichment/scaffolding-gate.ts`) AVANT
  persistance, et le grounding DataForSEO est chargé avant génération
  (`.cursor/rules/dataforseo-content-grounding.mdc`).
- Migrations forward-only ; jamais éditer un SQL appliqué.
- Ne jamais désactiver une policy RLS, un check CI, ou le Sentry init.

### 0.5 Format de reporting par WP (obligatoire en fin de tâche)

```
WP-<id> — <titre>
Statut : DONE | PARTIAL | BLOCKED (raison)
Fichiers modifiés : <liste>
Vérifications : <commandes exécutées + résultats>
Walk : <URLs + captures si user-visible>
Reste à faire : <explicite ou "aucun">
```

---

# LANE A — Back / plateforme

## WP-A1 — Rate limit `/api/agent/*` : fail-open → fail-closed en production

**Priorité** : P0 · **Effort** : 0,25 j · **Dépendances** : aucune

**Contexte.** `apps/web/src/server/agent/rate-limit.ts` retourne
`{ ok: true }` dans DEUX cas de dégradation : (1) Redis non configuré
(L69, `isRedisConfigured()`), (2) exception Upstash (L74-80, `catch`).
C'était un choix documenté « graceful degradation », mais l'audit le
requalifie P0 : la surface agent (27 endpoints, fan-out
Supabase/Amadeus) devient illimitée dès qu'Upstash tousse.

**Décision d'implémentation** (à suivre telle quelle) :

- Conserver le bypass E2E (`isE2EBypass()`, L34-39) tel quel.
- Cas « Redis non configuré » : fail-open **uniquement** si
  `process.env.VERCEL_ENV !== 'production'` (dev/preview restent
  utilisables sans Upstash). En production → retourner
  `{ ok: false, retryAfterSec: 60 }`.
- Cas « exception Upstash » (catch) : même règle — prod = fail-closed
  `retryAfterSec: 10`, hors prod = fail-open.

**Étapes.**

1. Lire le fichier entier + ses appels (`gateAgentRequest` dans
   `apps/web/src/server/agent/respond.ts`).
2. Implémenter un helper privé `failVerdict(retryAfterSec)` et la
   condition `isProd()` (lire `VERCEL_ENV`, fallback `NODE_ENV`).
3. Mettre à jour les commentaires (ils documentent l'ancien choix).
4. Tests : créer/étendre `rate-limit.test.ts` — 4 cas : bypass E2E,
   non-configuré en preview (open), non-configuré en prod (closed),
   catch en prod (closed). Mock de `process.env` par test.

**Vérification.**

```powershell
pnpm --filter @mch/web test -- rate-limit
pnpm --filter @mch/web typecheck
```

**Acceptation** : 4 tests verts ; aucun autre fichier modifié.
**Interdits** : ne pas toucher au limiteur (60/min), ni à `readClientIp`.

---

## WP-A2 — Gel Phase 6 runtime : couper Amadeus/Travelport des routes publiques

**Priorité** : P0 · **Effort** : 0,5-1 j · **Dépendances** : DÉCISION PO
requise. Par défaut (si le PO ne dit rien) : **option (a) = gel réel**.
⚠ S'exécute AVANT tout WP de la lane B/E qui touche
`hotel/[slug]/page.tsx`.

**Contexte.** AGENTS.md §4ter gèle les APIs booking jusqu'à Phase 6,
mais le runtime appelle : `getBestOfferForHotel` (Amadeus) via
`prepareHotelBookingRail` (`apps/web/src/server/booking/prepare-hotel-booking-rail.ts`
L136-148), `getAmadeusHotelSentiment` sur chaque fiche
(`hotel/[slug]/page.tsx` ~L410), et Travelport
(`/api/travelport/search`, `/api/cron/travelport-prewarm`,
`TravelportLiveRooms`). Coût : TTFB (3-12 s mesurés), quota vendor,
incohérence de gouvernance.

**Étapes (option a).**

1. Lire `apps/web/src/lib/booking/phase-6-flags.ts` —
   `isPhase6BookingEnabled()` existe déjà (défaut OFF).
2. Dans `prepareHotelBookingRail` : early-return du rail éditorial
   (CTA « Réserver via le Concierge ») quand `!isPhase6BookingEnabled()`,
   AVANT tout appel `getBestOfferForHotel`.
3. Dans `hotel/[slug]/page.tsx` : conditionner l'appel
   `getAmadeusHotelSentiment` au même flag (fallback : bloc avis
   Google/presse existant, déjà implémenté).
4. `/api/travelport/search` + `/api/cron/travelport-prewarm` : retourner
   `503 { error: 'phase6_disabled' }` quand flag OFF (garder le code,
   c'est un gel, pas une suppression). Le composant `TravelportLiveRooms`
   doit self-élider proprement (vérifier son fallback).
5. Vérifier que la fiche rend TOUJOURS le CTA éditorial (pas de trou
   dans le bloc 8 CDC).
6. Mettre à jour AGENTS.md §4ter : une ligne « gel runtime appliqué le
   2026-07-XX (WP-A2) ».

**Vérification.**

```powershell
pnpm --filter @mch/web test; pnpm --filter @mch/web typecheck
# dev local :
# curl http://localhost:3000/api/travelport/search?... → 503
# curl fiche → temps de rendu réduit, CTA concierge présent
```

**Acceptation** : 0 appel réseau Amadeus/Travelport dans le chemin de
rendu d'une fiche (vérifiable par log/timing) ; fiche walkée fr+en
(screenshot) ; E2E `booking`/`hotel` verts.
**Interdits** : ne rien supprimer de `packages/integrations` ; ne pas
toucher au JSON-LD.

---

## WP-A3 — Health endpoint réel (P2, optionnel, fin de lane)

`apps/web/src/app/api/health/route.ts` : ajouter 3 checks parallèles
timeout 2 s (Supabase REST `HEAD hotels?limit=1`, Redis `PING` si
configuré, réponse `{ ok, checks: {...} }` avec 503 si Supabase KO).
Test unitaire avec mocks. Pas de rate limit (health).

---

# LANE B — Front UI

## WP-B1 — Mentions légales : sortir du draft

**Priorité** : P0 · **Effort** : 0,25 j (+ inputs PO)

**Contexte.** `apps/web/src/app/[locale]/(legal)/mentions-legales/page.tsx`
rend des placeholders `[À COMPLÉTER]`, avec lien footer sur toutes les
pages (`site-footer.tsx`).

**Étapes.**

1. Demander au PO (bloc de questions UNIQUE en début de WP) : raison
   sociale, forme juridique, capital, SIREN/RCS, adresse siège,
   directeur de publication, hébergeur (Vercel Inc., adresse), n°
   immatriculation Atout France/IATA, médiateur du tourisme (MTV,
   obligatoire pour une agence de voyages FR).
2. Remplir les clés i18n fr + en (`i18n/messages/*.json`) — pas de
   texte en dur dans le TSX.
3. Retirer le flag/`IS_DRAFT` et le `noindex` si la page est complète.
4. **Si le PO ne répond pas** : retirer le lien footer (fr+en+mobile)
   et laisser la page noindex — commit séparé, réversible.

**Acceptation** : 0 occurrence `[À COMPLÉTER]` ; walk
`/mentions-legales` + `/en/mentions-legales` avec captures.

---

## WP-B2 — i18n des chaînes hardcodées (classements + global-error)

**Priorité** : P0 · **Effort** : 0,5 j

**Fichiers exacts** (repérés par l'audit) :

- `apps/web/src/app/[locale]/classement/[slug]/page.tsx` L544, L743
- `apps/web/src/app/[locale]/classements/page.tsx` L369
- `apps/web/src/app/[locale]/classements/[axe]/[valeur]/page.tsx` L355
- `apps/web/src/app/global-error.tsx` L45-49 (texte FR en dur)

**Étapes.**

1. Pour chaque site : identifier la chaîne FR, créer la clé
   `rankings.*` / `globalError.*` dans `fr.json` ET `en.json` (l'EN est
   une vraie traduction, pas une copie du FR).
2. `global-error.tsx` est hors provider next-intl (root) : utiliser le
   pattern minimal locale-detection par `document.documentElement.lang`
   ou un dictionnaire local à 2 entrées — pas d'import next-intl côté
   root error boundary si le provider n'y est pas.
3. Chercher d'autres résidus : `rg -n "« |Découvrez|Consultez" apps/web/src/app/[locale]/classement*` — traiter ce qui apparaît.

**Acceptation** : walk d'un classement EN
(`/en/classement/meilleurs-palaces-paris`) : 0 chaîne FR d'interface ;
typecheck + tests verts.

---

## WP-B3 — Dédoublonnage du titre (« … | MyConciergeHotel · MyConciergeHotel »)

**Priorité** : P1 · **Effort** : 0,25 j

**Contexte.** Le layout applique un template `'%s · MyConciergeHotel'`.
`apps/web/src/lib/seo/brand-title.ts` fournit `stripBrandSuffix()`
exactement pour éviter le doublon, avec tests — mais certaines pages
composent leur titre avec la marque déjà incluse SANS passer par le
strip. Constaté en prod sur : home (`MyConciergeHotel - La sélection… ·
MyConciergeHotel`), `/lieux` (`Lieux à visiter | MyConciergeHotel ·
MyConciergeHotel`), `/itineraires`.

**Étapes.**

1. `rg -n "MyConciergeHotel" apps/web/src/app/[locale] --glob "page.tsx"`
   — lister toutes les pages qui incluent la marque dans leur `title`.
2. Pour chacune : soit retirer la marque du titre composé (le template
   layout l'ajoute), soit passer par `stripBrandSuffix`. Choisir la
   première option (plus simple) sauf si le titre vient de la DB.
3. Cas spécial home : le title de la home doit être absolu
   (`title: { absolute: '…' }`) s'il doit contenir la marque en tête.
4. Ajouter un cas de test dans `brand-title.test.ts` reproduisant le
   doublon `· MyConciergeHotel · MyConciergeHotel`.

**Acceptation** : curl des `<title>` de `/`, `/lieux`, `/itineraires`,
`/recherche`, 3 fiches, 2 classements → exactement UNE occurrence de la
marque par titre.

---

## WP-B4 — `loading.tsx` + `error.tsx` sur les segments chauds

**Priorité** : P1 · **Effort** : 0,5 j

**Étapes.**

1. Créer `loading.tsx` (skeleton sobre : blocs gris animés, pas de
   texte hardcodé) dans : `app/[locale]/hotel/[slug]/`,
   `app/[locale]/destination/[citySlug]/`,
   `app/[locale]/classement/[slug]/`.
   S'inspirer des 4 `loading.tsx` existants (`classements/`,
   `recherche/`, `hotels/`, `itineraires/`) pour le style.
2. Créer `error.tsx` dans `app/[locale]/hotel/[slug]/` sur le modèle de
   `destination/[citySlug]/error.tsx` (réutilise `route-error.tsx`,
   capture Sentry, i18n).

**Acceptation** : navigation locale dev fiche→fiche affiche le
skeleton ; erreur simulée (throw dans la page en dev) affiche la
boundary i18n ; typecheck vert.

---

## WP-B5 — Paginer `/hotels` (10,4 Mo → < 500 Ko)

**Priorité** : P0 · **Effort** : 1 j

**Contexte.** `app/[locale]/hotels/page.tsx` rend les ~2 929 hôtels en
une page (10,4 Mo, 2 740 liens). Les sous-routes
`/hotels/[pays]/[ville]` existent déjà.

**Décision d'implémentation** :

- `/hotels` devient un **hub par pays** : liste des pays (127) avec
  compte d'hôtels + top-N villes chacune, ~0 lien fiche direct sauf une
  sélection éditoriale (12-24 fiches max).
- La longue traîne des liens fiche reste crawlable via
  `/hotels/[pays]` et `/hotels/[pays]/[ville]` (vérifier qu'ils listent
  bien tous les hôtels du scope, avec pagination `?page=` si > 200).
- PAS de `?page=` sur `/hotels` racine (le hub suffit).

**Étapes.**

1. Lire la page actuelle + son data-loader ; identifier la requête qui
   ramène tout le catalogue.
2. Remplacer par une agrégation par pays (count + villes) — si une RPC
   est nécessaire, l'ajouter en migration `00xx_hotels_country_counts_rpc.sql`
   (lecture seule, `security definer` non requis).
3. UI : grille pays (drapeau/nom/compte) + section « La sélection du
   Concierge » (24 fiches curées par `luxury_tier`).
4. Sur `/hotels/[pays]` : pagination serveur si > 200 hôtels
   (searchParam `page`, canonical propre : page 1 = canonical sans
   param, pages suivantes = self-canonical + `rel prev/next` non requis).
5. Vérifier `hubs.xml` : les URLs pays/villes y sont déjà — ne pas
   dupliquer.

**Acceptation** : `curl` de `/hotels` < 500 Ko ; chaque hôtel reste
joignable en ≤ 3 clics depuis `/hotels` (pays → ville → fiche) ; walk
fr+en desktop+mobile avec captures ; E2E existants verts.

---

## WP-B6 — Header homepage aligné (P1, après B5)

`conditional-site-chrome.tsx` masque `SiteHeader` sur `/` au profit de
`HomeKitHeader` (ancres `#hotels`…). Étapes : remplacer les ancres par
les vrais hubs (`/hotels`, `/destination`, `/classements`, `/lieux`,
`/le-concierge`) en CONSERVANT le design kit ; ou réactiver `SiteHeader`
sur la home si le design le tolère (décision PO si doute). Walk
desktop+mobile obligatoire, la home est la vitrine.

---

# LANE C — Contenu DataSEO P0 (DB)

> Pré-lecture obligatoire : `docs/audits/dataseo-action-plan-2026-06-29.md`
> (vagues, stop conditions), `.cursor/rules/dataforseo-content-grounding.mdc`,
> `.cursor/skills/keyword-grounding-dataforseo/SKILL.md`.
> Runner d'audit : `pnpm --filter @mch/editorial-pilot dataseo:audit -- --hotel-limit=100 --concurrency=2`.
> Un runner de patch existe déjà (non commité) :
> `scripts/editorial-pilot/src/hotels/patch-dataseo-p0-hotels.ts` — le
> lire, le finaliser, ne pas repartir de zéro.

## WP-C1 — Claims Palace : vérité Atout France juin 2026

**Priorité** : P0 · **Effort** : 1 j

**Vérité terrain** (communiqué Atout France 02/06/2026 + dossier de
presse) : **33 Palaces en France, dont 13 à Paris** : Bvlgari Paris,
Cheval Blanc Paris, Fouquet's Paris, Four Seasons George V, Hôtel de
Crillon, Plaza Athénée, La Réserve Paris, Le Bristol, Le Meurice,
Mandarin Oriental Lutetia, Royal Monceau, Shangri-La Paris, The
Peninsula Paris. **Ni le Ritz Paris ni le Park Hyatt Paris-Vendôme ne
sont Palaces.** Révision tous les **3 ans** (pas 5).

**Étapes.**

1. Requête PostgREST : lister les hôtels avec claim Palace
   (`luxury_tier=eq.palace` + recherche « Palace » dans
   `description_fr`, `factual_summary_fr/en`, `faq_content`) hors des
   33 officiels. Produire un CSV slug → champs fautifs.
2. Traiter d'abord les 10 fiches P0 du plan DataSEO (`the-berkeley`,
   `hotel-de-russie-rocco-forte-collection`, `hotel-ritz-paris`,
   `claridge-s-londres`, `burj-al-arab`, `the-plaza-hotel`…) : un hôtel
   étranger ne peut PAS être « Palace » (distinction française) —
   reformuler (« palace » minuscule descriptif interdit aussi : utiliser
   « hôtel de légende », « institution », la distinction réelle Forbes/
   LHW). Un claim retiré n'est jamais remplacé par un claim inventé.
3. Corriger le **contenu statique** de
   `/en/categorie/palaces-paris` + `/categorie/palaces-france` (chercher
   la source : clés i18n ou colonnes DB de la catégorie) : « twelve » →
   13, liste exacte ci-dessus, « five years » → 3 ans, retirer Ritz/
   Park Hyatt.
4. Chaque write : lot ≤ 30, `--dry-run` d'abord, `hasLeak()` sur tout
   texte réécrit, relecture d'une row post-write.

**Acceptation** : re-run `dataseo:audit` sur les slugs → famille
`claims` vide ; walk `/en/categorie/palaces-paris` (liste = 13 exacts) ;
snapshot rollback conservé dans `scripts/editorial-pilot/runs/`.

## WP-C2 — Meta titles cassés + FAQ langue mélangée + PAA bruitées

**Priorité** : P0 · **Effort** : 1 j · **Après C1** (mêmes rows).

1. Extraire du dernier rapport DataSEO
   (`scripts/editorial-pilot/runs/dataseo-actions-unified-*.md`) les
   actions par famille `meta`, `faq_lang`, `paa_noise`.
2. Meta : corriger dans la bande 140-170 (desc) via
   `run-hotel-meta-desc.ts --slugs=…` (générateur groundé existant).
3. FAQ langue : pour chaque fiche signalée, déplacer/retraduire la Q/R
   dans la bonne locale (patch déterministe, pas de régénération).
4. PAA bruitées (célébrités, fortunes, salaires, recrutement) : retirer
   des surfaces `faq_content`, `geo_qa` — suppression, pas réécriture.

**Acceptation** : re-audit familles `meta`+`faq_lang`+`paa_noise` = 0
sur les slugs traités ; spot-check 5 pages fr+en.

## WP-C3 — Purge des angles Phase 6 dans le contenu indexé

**Priorité** : P1 · **Effort** : 0,5 j

Chercher en DB (colonnes éditoriales hotels + rankings FR) et dans les
clés i18n : `Amadeus net rate`, `tarifs nets GDS`, `no commission
intermediary`, `paiement Amadeus`, promesses de prix/dispo live.
Reformuler vers la proposition éditoriale (« réservation via notre
conciergerie IATA »). Constaté en prod sur `/en/categorie/palaces-paris`
et `/en/classements/lieu/paris`. Coordonner avec la lane D si la chaîne
est dans une colonne `_en` d'un classement (créer un ticket croisé
plutôt que d'écrire hors périmètre).

---

# LANE D — Parité EN classements (DB)

> Pré-lecture : `docs/audits/rankings-enriched-content-audit-2026-06-29.md`,
> `.cursor/skills/llm-output-robustness/SKILL.md` (chunking, safeParse
> par item, salvage de phrases), leçons 7th/10th/14th wave d'AGENTS.md.
> Volumes : 795 `intro_en` stub, 274 justifications EN stub, 272 rows
> sections sans EN.

## WP-D1 — `intro_en` des 795 classements

**Priorité** : P0 · **Effort** : 1,5 j

1. Créer `scripts/editorial-pilot/src/rankings/translate-ranking-intro-en.ts`
   sur le modèle de `hotels/translate-sections-en.ts` (PostgREST,
   gpt-4o-mini, `response_format: json_object`, temp 0.3, `hasLeak()`
   sur la sortie, `--slug/--slugs/--all/--limit/--concurrency/--dry-run`).
2. Prompt : réécriture EN-GB fidèle de `intro_fr` — voix Concierge,
   chiffres/noms/prix TTC identiques au FR, AUCUN fait inventé, pas de
   traduction littérale mot-à-mot. Détection de stub : `intro_en` NULL,
   < 200 chars, ou commençant par le pattern stub identifié dans
   l'audit (le lire pour le regex exact).
3. Pilote : 10 slugs à intention internationale (Londres, Rome, Dubaï,
   NYC) → relecture manuelle → puis `--all` par lots de 50.
4. Leçons à appliquer d'office : chunker si > 4 items/call ; `safeParse`
   par item (jamais all-or-nothing) ; si le gate `hasLeak` déclenche,
   strip de la phrase fautive avant blank total ; `min()` Zod calibré
   sur l'instance légitime la plus courte.

**Acceptation** : requête count stubs → 0 ; 10 pages EN walkées ; 0
leak ; log `translated=… skipped=… leaked=…` archivé dans `runs/`.

## WP-D2 — Justifications EN (274) — même pipeline, colonne `justification_en` de `editorial_ranking_entries`, **clamp ≤ 1200 chars à frontière de phrase** (CHECK DB `…justification_fr_ck` a un équivalent EN — vérifier la contrainte avant d'écrire).

## WP-D3 — Sections EN (272 rows) — étendre le script D1 aux `editorial_sections` (title_en/body_en par ancre, 4 sections/call max). Après D1/D2.

---

# LANE E — Perf & crawl

## WP-E1 — ✅ FAIT (2026-07-02) — ADR-0031 tranché : Option C+ (pas d'ISR HTML)

**Résultat du spike (preuve prod, `scripts/perf/spike-csp-static-check.mjs`)** :
sous `'nonce-…' 'strict-dynamic'`, tout HTML caché (SSG / ISR / s-maxage) est
**inhydratable** — Next ne tamponne le nonce que sur un rendu dynamique, et
`strict-dynamic` fait ignorer `'self'`, donc le navigateur bloque TOUS les
scripts (inline bootstrap ET chunks externes `/_next/static`). Preuve :
`/mentions-legales` (force-static, HIT) = **58 violations CSP, zéro JS
exécuté** ; `/lieux` (dynamic) = 0 violation. Les options (1)-(4) de l'énoncé
initial étaient toutes fondées sur la prémisse fausse « le JSON-LD est le seul
consommateur du nonce » — le vrai consommateur est le bootstrap Next lui-même.

**Décision (ADR-0031, Accepted)** : `force-dynamic` conservé partout ; les
4 pages légales `force-static` (cassées en prod) repassent dynamiques ; le
levier perf = **cache de la couche data** (`unstable_cache`) + fix CPU.

**Livré** :

- `server/destinations/cities.ts` : scan catalogue 2219 rows sous
  `unstable_cache` (TTL 1 h, tag `hotels-catalogue`, descriptions cappées
  220 c pour rester < 2 MB/entrée).
- `server/places/list-places.ts` : `listPlaceCities` idem (tag
  `places-catalogue`).
- **Fix CPU majeur** `components/editorial/enriched-text.tsx` : l'auto-linker
  compilait ~5000 regex par section et les exécutait toutes par paragraphe →
  cache WeakMap par link-map + regex lazy + pré-filtre `includes`.
  `/destination/paris` 21 s → **3,2 s** ; classement 10,6 s → **0,6 s** ;
  fiche hôtel → **1,2 s** (local `next start`, cache chaud).
- 4 pages légales : `force-static` → `force-dynamic` (JS de nouveau vivant,
  TTFB local 25-75 ms).

## WP-E2 — ❌ ANNULÉ (invalidé par le spike E1)

L'ISR HTML est structurellement incompatible avec la CSP nonce actuelle
(voir E1). NE PAS ajouter `revalidate` / retirer `force-dynamic` sur une
route HTML tant que la CSP porte un nonce par requête. Le gain visé est
déjà largement obtenu par le cache data + le fix EnrichedText.

## WP-E2' — ✅ FAIT (2026-07-02) — extension du cache data + fix 2 Mo

**Bug critique trouvé et corrigé** : le cache catalogue E1 (entrée unique)
sérialisait à **3,07 Mo > la limite 2 Mo** du Data Cache — chaque write
échouait avec un simple log serveur ("items over 2MB can not be cached")
et le scan complet continuait de tourner à chaque requête (home / hub /
destination coincés à 2,5-5 s chaud). Fix : **cache par page de 1000 rows**
(~1,3 Mo/entrée, la page est dans la clé). Leçon capitalisée dans l'ADR-0031
et `performance-engineering` : un échec de write `unstable_cache` est
SILENCIEUX — toujours vérifier le log serveur + la chute effective du TTFB.

Readers également mis sous `unstable_cache` (contrat throw-on-error) :

- `listPublishedRankings` (7+ round-trips séquentiels, tag `rankings-catalogue`)
- `getGuideBySlug` + `listPublishedGuides` (tag `editorial-guides`)
- `listPublishedPlacesForCity` (tag `places-catalogue`)

TTFB chaud local après fix : home **114 ms**, hub `/destination` **163 ms**,
`/destination/paris` **113 ms**, guide-less **97 ms**, `/classements`
**85-190 ms**. Reliquat : fiche hôtel ~1,3 s (fetch per-slug non caché,
acceptable) + paginer `/hotels` (HTML 10,4 Mo — lane B).

**Prod vérifié post-déploiement (2026-07-02, commit `825d2f92`, TTFB
chaud, x-vercel-cache=MISS by design)** : home **357 ms** (baseline
2 752), `/destination` **453 ms** (12 034), `/destination/paris`
**540 ms** (12 233), classement **455 ms** (10 623), fiche Le Meurice
**749 ms** (3 000-4 464), `/lieux/paris` **281 ms**, mentions-légales
**237 ms** (JS vivant). Cible WP-E3 (< 800 ms classement/fiche,
< 3,5 s destination) **atteinte partout**. Contenu FR + EN vérifié
(guide Paris 14 h2 + Meurice sur les deux locales, 0 carte "0 hôtels").

## WP-E3 — ✅ Script livré : `scripts/perf/measure-ttfb.ps1` (+ `ttfb-probe.mjs`)

20 URLs × 3 hits → CSV `scripts/perf/runs/ttfb-<date>.csv` + médiane des
hits chauds. Baseline 02/07 (prod, tout MISS) : home 2 752 ms, fiche
3 000-4 464 ms, classement 10 623 ms, destination 12 034-12 233 ms.
⚠ Cible révisée post-ADR : `x-vercel-cache` restera **MISS by design**
(HTML dynamique) — la cible est **TTFB chaud < 800 ms sur classement /
fiche, < 3,5 s sur destination long-read**, à relancer après déploiement.

---

# LANE F — Autorité & couverture

## WP-F1 — Matrice lexicale « hôtel de luxe / luxury hotels »

**Priorité** : P0 SEO · **Effort** : 1 j + génération

1. Lire `.cursor/skills/editorial-rankings-matrix/SKILL.md` +
   `scripts/editorial-pilot/src/rankings/combinator.ts`.
2. Ajouter l'axe/alias `hotel-de-luxe-{ville}` pour les 20 villes à
   plus fort volume (vérifier via grounding DataForSEO le volume par
   ville AVANT de créer le slug — pas de slug sans volume).
   ⚠ `hotel-de-luxe-paris` existe déjà (`/classement/hotel-de-luxe-paris`
   live) — inventorier l'existant d'abord, ne créer QUE les manquants.
3. Génération par `run-rankings-v2-bulk.ts --only-file=…` (concurrency
   3-4, cache disque `data/rankings-cache/`).
4. Côté EN : ne PAS créer de slugs séparés — renforcer title/H1/meta
   `_en` des classements existants sur « luxury hotels {city} »
   (coordination lane D : F ne touche pas les colonnes `_en` des rows
   que D traite en même temps — partitionner par lots de slugs).

## WP-F2 — 12 rankings géo gap vs yonder

Villes listées dans
`docs/audits/competitor-travellers-yonder-audit-2026-06-23.md` §4
(Vienne, Crète, Lisbonne…). Pour chaque ville : (1) audit inventaire
(`hotels` publiés dans la ville) ; ≥ 4 → générer via la matrice ; < 4 →
reporter la ville dans un backlog « scaffold fiches d'abord » (ne PAS
générer un classement à 2 hôtels).

## WP-F3 — EEAT backfill

(1) `external_sources` : re-run `enrich-wikidata-ids.ts` sur les ~150
fiches sans provenance, puis
`convert-wikidata-to-external-sources.ts --slugs=…` (respecter le
détecteur `isToxicOfficialUrl` — leçons 3rd/4th wave AGENTS.md, ne
jamais accepter un domaine squatter `.net/.org/.info` à sous-domaine
collé). (2) Ratings Google : relancer la sync sur les 27 % de fiches
sans `AggregateRating` (pipeline de la restart-wave W3).

## WP-F4 — Ops autorité (humain + agent)

Hebdo : résoumission sitemaps GSC, suivi impressions (baseline 191
pages), outreach backlinks (dossier de presse, Atout France, R&C,
offices de tourisme, HARO). L'agent prépare les listes/brouillons, le
PO envoie.

---

# LANE G — Conformité pipelines & observabilité

## WP-G1 — Grounding + gates sur les générateurs restants

1. `hotels/premium-section-generator.ts` : ajouter `loadDfsConfig()` +
   `groundHotel()` + injection `renderGroundingForPrompt()` sous
   `### Ancrage SEO/GEO (DataForSEO)` + `hasLeak()` sur chaque section
   sortie (refus de write si < seuil propre). Suivre le pattern exact de
   `enrichment/enrich-hotel-content.ts` (8th wave). Flag
   `--no-grounding` de secours. Dégradation propre si DFS off
   (`grounding=off` logué).
2. `enrichment/enrich-hotel-content.ts` + `places/enrich-places-editorial.ts` :
   ajouter `evaluatePaaCoverage` post-génération
   (`hotels/faq-perplexity-gates.ts`) — warning tracé `dfs_paa_coverage=<pct>`,
   non bloquant.
3. Mettre à jour la table des pipelines dans
   `.cursor/rules/dataforseo-content-grounding.mdc`.

## WP-G2 — Neutraliser les générateurs legacy

`guides/generate-guide.ts`, `rankings/generate-ranking.ts`,
`rankings/meta-desc-generator.ts` (+ `run-ranking-meta-desc.ts`),
`hotels/description-extend-generator.ts`, `concierge/run-humanizer-faq.ts` :
en tête de chaque fichier, un guard bloquant :

```ts
if (process.env['MCH_ALLOW_LEGACY_GENERATOR'] !== '1') {
  throw new Error(
    'DEPRECATED — non grounded/hasLeak. Use the v2 pipeline. See dataforseo-content-grounding.mdc',
  );
}
```

Ne PAS supprimer (historique/rollback). Vérifier qu'aucun script pnpm ni
cron ne les référence.

## WP-G3 — Persister `dfs_paa_coverage`

Migration `00xx_editorial_runs_paa_coverage.sql` : table
`editorial_run_metrics (id, entity_type, entity_slug, metric, value
numeric, run_at timestamptz, runner text)` + RLS lecture staff. Les
runners qui calculent `evaluatePaaCoverage` y écrivent une row (INSERT
PostgREST, best-effort, jamais bloquant). Requête d'audit catalogue
fournie en commentaire de migration.

## WP-G4 — Brancher pino (`@mch/observability`)

Sur 5 fichiers chauds d'abord : `get-hotel-by-slug.ts`,
`server/agent/respond.ts`, `api/agent/search/route.ts`,
`prepare-hotel-booking-rail.ts`, `get-best-offer.ts`. Remplacer
`console.warn/error` par le logger (champs : `route`, `vendor`,
`latency_ms`, `status` — JAMAIS email/nom/tel). Pas de big-bang : le
reste suit par opportunité.

## WP-G5 — Unifier l'indexabilité SQL/TS

`packages/db/migrations/0078_list_indexable_hotel_slugs_rpc.sql` duplique
`apps/web/src/server/hotels/indexability.ts`. Forward-only : créer
`00xx_…_rpc_v2.sql` régénérée depuis le prédicat TS (commentaire
`-- GENERATED FROM indexability.ts — keep in sync`), + un test
d'intégration qui compare le count RPC vs le count TS sur un
échantillon. Ne pas éditer 0078.

## WP-G6 — Sanitiser le kit HTML

`components/hotel/kit/hotel-page-kit.tsx` injecte `prefixHtml`/`mainHtml`
via `dangerouslySetInnerHTML`. Étapes : tracer la provenance (pipeline
kit → DB) ; si le HTML est généré par notre pipeline uniquement,
ajouter une sanitisation serveur (allowlist tags/attrs — pas de
`script`, `on*`, `javascript:`) au point d'ÉCRITURE et au point de
rendu ; test avec payload XSS fixture.

---

# Matrice de lancement parallèle (jour 1)

| Agent  | Lane | Premier WP                        | Peut démarrer                                |
| ------ | ---- | --------------------------------- | -------------------------------------------- |
| 1      | A    | A1 puis A2                        | immédiatement                                |
| 2      | B    | B1 + B2                           | immédiatement                                |
| 3      | C    | C1                                | immédiatement (lecture plan DataSEO d'abord) |
| 4      | D    | D1 pilote 10 slugs                | immédiatement                                |
| 5      | F    | F3 (EEAT, sans collision) puis F1 | immédiatement                                |
| 6      | G    | G2 (déterministe) puis G1         | immédiatement                                |
| senior | E    | E1 (ADR + POC)                    | immédiatement                                |

B3/B4 suivent B1/B2 ; B5 après A2 (fiche stabilisée) ; E2 après E1 ;
D2/D3 après D1 ; F1-EN coordonné avec D par partition de slugs ;
G3 après G1.

# Checklist de fin de vague (orchestrateur)

1. Chaque WP a produit son bloc de reporting (§0.5).
2. `pnpm turbo run typecheck` + tests des packages touchés verts.
3. Re-audit ciblé (dataseo:audit pour C/D, mesure TTFB pour E, count
   stubs pour D).
4. Walks fr+en archivés (captures) pour tout user-visible.
5. Mise à jour de la table de progression AGENTS.md §4ter si une phase
   bouge matériellement.
