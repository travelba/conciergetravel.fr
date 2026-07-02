# Rapport KPI hebdomadaire — Semaine 27 (BASELINE / point zéro)

**Semaine ISO** : 2026-W27 (lun. 2026-06-29 → dim. 2026-07-05)
**Date de mesure** : 2026-07-02 (soir)
**Auteur** : WS-I (Mesure & reporting) — itération baseline semaine 0
**Mission** : plan maître `docs/runbooks/master-plan-multi-agent-2026-07.md` §1 + §5 WS-I
**Portée** : lecture seule. Aucune modification de contenu, de code ou de DB.
**Statut env** : pas de credentials DataForSEO/Supabase exécutables par le script local
(`track-serp-positions.ts` non lançable en l'état) → mesures via **MCP DataForSEO
(`user-dfs`)** pour SERP + autorité, **MCP Supabase (`plugin-supabase`, projet
`fsmfozxgujskluxakeoq`)** pour le contenu, **`curl.exe`** pour la perf prod.

---

## 1. Table KPI du plan maître — colonne « Baseline W27 » remplie

| KPI                                                | Baseline 02/07 (plan)    | **Baseline W27 (mesurée)**                                                                                           | Tendance | Source W27                                                                            |
| -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| Mots-clés classés FR (DataForSEO Labs)             | 1                        | **1** (overview, synonymes fusionnés) / **3** (ranked_keywords granulaire) ; ETV 0,672                               | n/a      | MCP `dataforseo_labs_google_domain_rank_overview` + `..._ranked_keywords`, live 02/07 |
| Pages avec impressions GSC                         | 191 (2,3 %)              | **191 / 8 202 (2,3 %)** — _export GSC frais non fourni — à compléter par le PO_                                      | n/a      | `docs/audits/gsc-indexation-2026-06-29.md` (28 j = 90 j)                              |
| Panier 12 requêtes cibles en top 20                | 0/12                     | **0/12** (FR) ; **0/15** en incluant les 3 EN                                                                        | n/a      | MCP `serp_organic_live_advanced`, live 02/07 (détail §2)                              |
| Backlinks référents (domaines)                     | ~0                       | **non re-mesuré ce run** (API backlinks non appelée) — repris à ~0                                                   | n/a      | diagnostic plan 02/07                                                                 |
| TTFB fiche hôtel (cache HIT)                       | 3-4,5 s (MISS permanent) | **0,80-1,07 s** (MISS permanent, 2/2 hits) — HIT jamais atteint                                                      | n/a      | `curl.exe` prod 02/07 (détail §5)                                                     |
| Intros EN classements réelles                      | 68/863 (8 %)             | **863/863** au proxy `length(intro_en) > 200` ⚠ **diverge fortement** (voir §4 + alerte)                             | n/a      | MCP Supabase `execute_sql` 02/07                                                      |
| Claims Palace non sourcés                          | > 0 en prod              | **non mesuré ce run** (territoire WS-C) — présumé > 0                                                                | n/a      | —                                                                                     |
| Fiches top-100 marque ≥ 20 photos / ≥ 6 catégories | ~0                       | **~0** pour le KPI exact ; **54 / 2 929 (1,8 %)** fiches publiées ≥ 20 photos catalogue-large ; **6** seulement ≥ 30 | n/a      | MCP Supabase `jsonb_array_length(gallery_images)` 02/07                               |
| CTA réservation mort (bouton disabled)             | majorité catalogue       | **non mesuré ce run** (territoire WS-F)                                                                              | n/a      | —                                                                                     |
| Demandes concierge / mois (funnel email)           | non mesuré               | **non mesuré** (pas d'instrumentation)                                                                               | n/a      | —                                                                                     |

> **Tendance = n/a partout** : c'est la première itération, il n'existe pas encore
> de point antérieur comparable dans la série `kpi-weekly-*`. La colonne tendance
> se remplira à W28.

---

## 2. SERP — panier de requêtes (live 02/07, MCP `serp_organic_live_advanced`)

**Position de `myconciergehotel.com`** — exacte si dans le top relevé, sinon « absent ».
Profondeur relevée : page 1 organique (≈ top 10-15) pour chaque requête ; complétée
par l'index DataForSEO Labs `ranked_keywords` pour confirmer le top 100.

### 2.1 FR (location France, langue fr)

| #   | Requête                    | Position MCH | Top organique (contexte concurrentiel)                        |
| --- | -------------------------- | ------------ | ------------------------------------------------------------- |
| 1   | meilleurs hotels venise    | **absent**   | #1 **yonder.fr**, #2 travellers-society, #3 lauraenvoyage     |
| 2   | meilleurs hotels paris     | **absent**   | **yonder.fr** (haut de page 1), tripadvisor, larevuedeshotels |
| 3   | meilleurs hotels rome      | **absent**   | #1 **yonder.fr**, #2 guide.michelin, #3 travellers-society    |
| 4   | hotel de luxe paris        | **absent**   | **yonder.fr** #1 organique, lartisien, booking                |
| 5   | palace paris               | **absent**   | atout-france, wikipedia, 5starhotels.paris                    |
| 6   | meilleurs hotels dubai     | **absent**   | #1 **yonder.fr**, travellers-society, tripadvisor             |
| 7   | meilleurs hotels marrakech | **absent**   | #1 travellers-society, tripadvisor, vogue                     |
| 8   | hotel de luxe courchevel   | **absent**   | excellencecourchevel, airelles, chevalblanc                   |
| 9   | meilleurs hotels spa paris | **absent**   | letsgomylove, staycation, **yonder.fr**                       |
| 10  | plus beaux hotels paris    | **absent**   | #1 **yonder.fr**, timeout, guide.michelin                     |
| 11  | meilleurs hotels londres   | **absent**   | #1 **yonder.fr**, guide.michelin, voyage-prive                |
| 12  | palace courchevel          | **absent**   | excellencecourchevel, airelles, elle.be                       |

**FR : 0/12 dans le top 100.** `yonder.fr` est **#1 organique sur 5/12** (venise,
rome, dubai, plus beaux paris, londres) et présent en page 1 sur la majorité du
reste — confirmation directe de la règle `competitor-benchmark-yonder`.

Les seuls mots-clés FR où MCH apparaît (hors panier, via `ranked_keywords`) :
`concierge in hotel` (#20), `conciergerie hotel` (#31), `hôtels design paris` (#31)
— navigationnels/marque, aucun volume commercial « meilleurs hôtels {ville} ».

### 2.2 EN (location United States, langue en)

| #   | Requête             | Position MCH                                                                           | Top organique (contexte concurrentiel)              |
| --- | ------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 13  | best hotels venice  | **absent**                                                                             | forbestravelguide, annees-de-pelerinage, cntraveler |
| 14  | luxury hotels paris | **absent**                                                                             | forbestravelguide, slh, americanexpress             |
| 15  | best hotels rome    | **absent page 1** ; **≈ #51** (index DFS Labs, `/en/classement/meilleurs-hotels-rome`) | forbestravelguide, snaphappytravel, cntraveler      |

**EN : 0/3 en top 20.** Signal notable : MCH tient un **≈ #51 sur « best hotels rome »**
(et #38 sur « best hotels in rome 2025 ») aux US — premier pied, ténu, sur une vraie
requête EN commerciale. Non documenté dans les baselines de juin.

---

## 3. Autorité — snapshot DataForSEO Labs domain rank overview (02/07)

| Domaine / marché                              | Keywords   | Distribution positions                       | ETV (visites/mois est.) |
| --------------------------------------------- | ---------- | -------------------------------------------- | ----------------------- |
| **myconciergehotel.com** — France / fr        | **1**      | 1 en pos. 21-30                              | **0,672**               |
| **myconciergehotel.com** — United States / en | **1**      | 1 en pos. 21-30                              | **0,084**               |
| **yonder.fr** — France / fr                   | **14 727** | **616** en P1, 1 486 en P2-3, 5 164 en P4-10 | **418 735,663**         |

> `ranked_keywords` (granulaire, sans fusion de synonymes) remonte 3 kw FR et 2 kw
> US/en pour MCH (cf. §2) ; l'overview les cluster à 1. **L'écart d'autorité reste
> d'ordre 1 : 14 700** vs yonder (goulot n°1 du plan, gelé par la décision D4). ETV
> MCH ≈ 0,7 visite/mois FR contre ~418 k pour yonder.

---

## 4. Contenu — comptages MCP Supabase (`execute_sql`, projet `fsmfozxgujskluxakeoq`, 02/07)

| Métrique                                                          | Valeur W27              |
| ----------------------------------------------------------------- | ----------------------- |
| Hôtels publiés (`is_published = true`)                            | **2 929**               |
| Hôtels total (toutes lignes)                                      | 2 985                   |
| Classements publiés (`editorial_rankings.is_published`)           | **863**                 |
| Classements total                                                 | 876                     |
| Classements publiés avec `intro_en` réelle (proxy `length > 200`) | **863 / 863 (100 %)** ⚠ |
| Classements publiés avec `intro_fr` réelle (proxy `length > 200`) | 863 / 863 (100 %)       |
| Fiches publiées avec ≥ 10 photos (`gallery_images`)               | 2 739 / 2 929 (93,5 %)  |
| Fiches publiées avec ≥ 20 photos                                  | **54 / 2 929 (1,8 %)**  |
| Fiches publiées avec ≥ 30 photos (plancher CDC §2.2)              | **6 / 2 929 (0,2 %)**   |

⚠ **La dimension « ≥ 6 catégories » n'est pas mesurée ici** (nécessiterait de compter
les catégories distinctes par fiche) : le KPI exact « top-100 marque ≥ 20 photos /
≥ 6 catégories » reste donc à ~0 tant que la liste top-100 et le comptage catégories
ne sont pas outillés (WS-G).

⚠ **Divergence majeure sur les intros EN** : le proxy `length(intro_en) > 200`
donne **863/863** alors que le plan documente **68/863 (8 %)** de « réelles »
(`rankings-enriched-content-audit-2026-06-29.md`). Deux hypothèses (à trancher par
le PO / WS-D avant toute (re)génération) :

1. le champ `intro_en` a été peuplé partout depuis le 29/06 (backfill non tracé) ;
2. le critère « réelle vs stub » de l'audit est **qualitatif** (EN natif vs traduction
   littérale / une phrase), non capturé par un simple seuil de longueur — un stub
   « traduit » peut dépasser 200 caractères.
   Le proxy longueur **surestime donc probablement** la parité EN réelle. **À re-auditer
   avec le critère natif** (voir recommandation §7-1).

---

## 5. Performance — TTFB + `x-vercel-cache` prod (`curl.exe`, 2 hits/URL, 02/07)

| URL                                   | Type        | TTFB hit 1 | TTFB hit 2 | x-vercel-cache  |
| ------------------------------------- | ----------- | ---------- | ---------- | --------------- |
| `/`                                   | home        | 1,896 s    | 0,959 s    | **MISS / MISS** |
| `/hotel/le-meurice`                   | fiche       | 1,070 s    | 0,804 s    | MISS / MISS     |
| `/hotel/le-bristol-paris`             | fiche       | 0,940 s    | 0,865 s    | MISS / MISS     |
| `/hotel/four-seasons-hotel-george-v`  | fiche       | 0,810 s    | 0,803 s    | MISS / MISS     |
| `/classement/meilleurs-hotels-rome`   | classement  | 0,580 s    | 0,541 s    | MISS / MISS     |
| `/classement/palaces-de-france-2026`  | classement  | 0,624 s    | 0,567 s    | MISS / MISS     |
| `/classement/meilleurs-hotels-venise` | classement  | 0,514 s    | 0,554 s    | MISS / MISS     |
| `/destination/paris`                  | destination | 0,842 s    | 0,478 s    | MISS / MISS     |
| `/destination/courchevel`             | destination | 0,513 s    | 0,468 s    | MISS / MISS     |
| `/lieux/paris/roland-garros-porte-30` | lieu        | 0,400 s    | 0,446 s    | MISS / MISS     |

- **`x-vercel-cache: MISS` sur les 20 hits (100 %)** — verrou `force-dynamic`
  (nonce CSP, ADR-0031) confirmé : aucun HTML public ne bénéficie du cache CDN,
  même au 2ᵉ hit. C'est le KPI perf **le plus actionnable à 100 % agent** (WS-E).
- **TTFB 0,40-1,90 s** (home la pire à froid) — **nettement meilleur** que les
  3-4,5 s documentés dans le plan (§1 + §0). Le HTTP 200 est renvoyé sur les 10 URLs.

---

## 6. Alertes (max 3)

1. **Autorité quasi nulle, immobile sous D4.** 1 kw classé FR (ETV 0,67) contre
   14 727 pour yonder (ETV ~418 k) — ratio ≈ 1:14 700. C'est le goulot n°1 du plan
   et l'outreach est gelé (D4) : sans levier autorité, les KPI « panier top 20 » et
   « pages indexées » ne décolleront quasi pas d'ici M+1 (conséquence assumée §2 du plan).
2. **Photos très en dessous du plancher CDC.** Seulement 54/2 929 fiches publiées
   (1,8 %) atteignent ≥ 20 photos et **6 seulement (0,2 %)** ≥ 30 — le KPI top-100
   marque est à ~0. Sur un marché où l'image est le 1er signal de confiance face à
   Booking, c'est un gap structurel (WS-G).
3. **Cache HTML 100 % MISS.** 20/20 hits en MISS : le crawl et l'UX portent l'intégralité
   du coût origine à chaque requête. Débloquer l'ISR/CSP-hash (WS-E) est le seul KPI
   perf entièrement sous contrôle agent.

---

## 7. Recommandations (max 3)

1. **Vérifier d'urgence la métrique « intros EN réelles » avant tout (re)travail EN.**
   Le proxy longueur (863/863) contredit frontalement le 68/863 documenté : soit un
   backfill récent, soit un critère qualitatif non capturé. WS-D doit re-auditer avec
   le vrai critère (EN natif vs traduction/stub) pour ne pas régénérer 795 intros déjà
   correctes — ou au contraire ne pas croire une parité EN qui n'existe pas.
2. **Prioriser WS-E (ISR + CSP hash).** Le MISS 100 % est le seul KPI mesuré ce run
   qui soit actionnable à 100 % par agent (l'autorité est gelée par D4). Rendre le HTML
   cacheable améliore simultanément crawl budget (goulot indexation) et TTFB/UX.
3. **Fournir un export GSC frais daté (PO, non délégable).** La couverture 191/8 202
   date du 29/06 ; sans export hebdomadaire daté, le KPI « pages avec impressions » ne
   se pilote pas et la tendance W28 restera aveugle sur ce point.

---

## 8. Chiffres qui surprennent vs baselines documentées de juin

| Sujet                   | Baseline juin documentée                                               | Mesure W27                      | Écart                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hôtels publiés          | 2 219 (`AGENTS.md`) / 2 984 total (`catalogue-stats`, `gsc-...-06-29`) | **2 929 publiés** (2 985 total) | +710 vs `AGENTS.md` — flip catalogue postérieur à la doc ; `AGENTS.md` §1 est **périmé**                                   |
| Classements publiés     | 549 publiés / 563 (AGENTS.md) ; ~816-863 (gsc doc)                     | **863 publiés** (876 total)     | +300 vs AGENTS.md — corpus classements nettement étendu                                                                    |
| TTFB fiche hôtel        | 3-4,5 s (plan §0/§1)                                                   | **0,80-1,07 s**                 | Bien meilleur que documenté (mais MISS permanent inchangé) — la baseline 3-4,5 s semble surévaluée / mesurée en cold-start |
| Intros EN « réelles »   | 68/863 (8 %)                                                           | **863/863** au proxy longueur   | Divergence la plus forte — à re-auditer au critère natif (§4 + §7-1)                                                       |
| « best hotels rome » EN | non documenté                                                          | MCH **≈ #51** (DFS Labs)        | Premier pied EN commercial, ténu, non tracé jusqu'ici                                                                      |

> **À retenir** : les baselines de contenu d'`AGENTS.md` (2 219 hôtels, 549 rankings)
> sont périmées — la source fiable est la DB live (2 929 / 863 au 02/07). Les baselines
> SEO/autorité (1 kw FR, 0/12 top 20, 191 pages GSC, yonder 14 727) sont **confirmées**.
> La seule vraie inconnue à lever est la parité ER des intros EN.
