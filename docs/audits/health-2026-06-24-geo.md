# Audit GEO / AEO prod (read-only) — MyConciergeHotel.com

- **Date** : 2026-06-24
- **Worker** : Audit GEO / AEO prod (read-only)
- **Périmètre** : optimisation pour les moteurs de réponse / LLM (GEO = Generative
  Engine Optimization, AEO = Answer Engine Optimization). Référence :
  `.cursor/skills/geo-llm-optimization/SKILL.md`.
- **Méthode** : `curl` prod (live), parsing JSON-LD/DOM, test réel des endpoints
  agent, test réel de citabilité via le MCP Perplexity (Sonar Pro), benchmark
  yonder.fr. Aucune écriture DB, aucun push, aucune modif fichier hors ce rapport.

---

## Verdict & score

> **Score GEO / AEO : 6 / 10.**
>
> Deux sous-axes divergent radicalement :
>
> | Sous-axe                                                        | Score      | Lecture                                                                                                                                                                                                                                                |
> | --------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
> | **Readiness / structure machine-lisible (ce que MCH contrôle)** | **9 / 10** | Best-in-class. llms.txt riche, 28 agent-skills (26 endpoints qui résolvent tous), FAQPage + ItemList + TravelAgency JSON-LD, EEAT provenance visible + endpoint, robots autorise tous les bots IA, fraîcheur datée. **Largement au-dessus de yonder.** |
> | **Citabilité GEO réelle (le KPI business)**                     | **1 / 10** | **0 citation sur 4 requêtes d'acquisition Perplexity**, y compris sur la niche propre de MCH (« conciergerie pour réserver un palace »). yonder.fr est cité 3/4 avec **quasi zéro structured data.**                                                   |
>
> **Conclusion** : l'infrastructure GEO est prête et supérieure à la concurrence,
> mais elle ne produit aujourd'hui **aucune** acquisition via les moteurs de
> réponse. Le verrou n'est PAS structurel — il est **d'autorité / d'indexation /
> de backlinks**. C'est exactement le diagnostic de la règle
> `competitor-benchmark-yonder.mdc` (« on perd sur autorité/indexation »), ici
> **prouvé en conditions réelles**. La structure est un moat qui ne paiera qu'une
> fois le domaine indexé et cité par les sources tierces que Perplexity lit.

---

## P0 — Citabilité réelle nulle dans les moteurs de réponse

### P0.1 — MCH cité 0 fois sur 4 requêtes d'acquisition Perplexity (yonder 3/4)

Test réel via MCP Perplexity (Sonar Pro, `search_context_size: high`), 2026-06-24.
**MyConciergeHotel.com n'apparaît dans AUCUNE citation.**

| Requête                                                               | MCH cité ? | Qui est cité à la place (extrait réel des citations)                                                                                      |
| --------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| « Quels sont les meilleurs hôtels de luxe à Venise ? »                | ❌ Non     | bonjourvenise, tripadvisor, **travellers-society.com**, generationvoyage, **yonder.fr**, lefigaro, lartisien, booking                     |
| « Quels sont les meilleurs palaces à Paris ? »                        | ❌ Non     | elle.be, aeroaffaires, france.fr, **yonder.fr**, cometoparis, lartisien, 5starhotels.paris, atout-france, mybusinessevent, guide.michelin |
| « Quelle conciergerie pour réserver un palace / hôtel d'exception ? » | ❌ Non     | **palaceguest.com**, **palacesdefrance.com**, **lecollectionist.com**, auguste-patrimoine, atout-france, france.fr                        |
| « Meilleurs hôtels de Rome en 2026 ? »                                | ❌ Non     | tripadvisor, **yonder.fr** (« Les 20 meilleurs hôtels de Rome »), lefigaro, routard, petitfute, bonjourrome, booking                      |

**Le plus douloureux** : la requête n°3 est le cœur de cible exact de MCH
(« conciergerie pour réserver un palace »). Même là, MCH est absent au profit de
`palaceguest.com`, `palacesdefrance.com` et `lecollectionist.com` — des sites à la
structure machine bien plus pauvre.

**Root cause** : ce n'est pas un défaut de structure (voir P1/P2 : la structure
est excellente). Perplexity retrieve des pages **indexées et citées par d'autres
sources**. MCH n'est pas (encore) dans le graphe de retrieval :

- domaine jeune / autorité faible,
- absent des listes tierces que les moteurs de réponse agrègent (cometoparis,
  lartisien, elle.be, aeroaffaires, palaceguest…),
- indexation GSC encore partielle (Phase 5 « Observability & GSC submit » non
  terminée — sitemap 252→2219 entries pas soumis).

**Action corrective (hors périmètre on-page, mais c'est LE levier business)** :

1. **Indexation** — finir la Phase 5 : régénérer + soumettre le sitemap (2219
   fiches), forcer le crawl GSC, vérifier la couverture réelle (pages indexées vs
   publiées). Sans indexation Google, pas d'AI Overviews ni de retrieval Perplexity.
2. **Off-site / autorité** — programme de citations & RP : faire entrer la marque
   dans les listicles que les LLM lisent (presse voyage, annuaires palace,
   partenariats). C'est le seul écart réel avec yonder.
3. **Mesure** — re-tester ces 4 requêtes mensuellement (ce protocole Perplexity)
   comme KPI GEO. Objectif : passer de 0/4 à ≥1/4 cités.

---

## P1 — Défauts on-page qui dégradent l'actionnabilité agent

### P1.1 — Les slugs d'exemple du manifeste agent-skills 404 (`ritz-paris`)

`agent-skills.json` utilise `ritz-paris` comme slug d'exemple dans **4 skills**
(`get-hotel`, `get-concierge-tip`, `get-hotel-sources`, `get-places-nearby`). Or
le slug réel est **`hotel-ritz-paris`**. Un LLM qui copie l'exemple documenté
tombe sur un 404 :

```
GET /api/agent/hotel-sources/ritz-paris      → HTTP 404 {"ok":false,"error":"not_found","slug":"ritz-paris"}
GET /api/agent/concierge-tip/ritz-paris      → HTTP 404 {"ok":false,"error":"not_found","slug":"ritz-paris"}
GET /api/agent/hotel-sources/hotel-ritz-paris→ HTTP 200 {"ok":true,"slug":"hotel-ritz-paris","hotelName":"Ritz Paris",...}
```

C'est un auto-goal sur le différenciateur GEO n°1 (l'API agent-actionnable).
**Action** : remplacer `ritz-paris` par un slug réel (`hotel-ritz-paris` ou
`hotel-du-cap-eden-roc`, qui lui résout) dans toutes les descriptions du manifeste
ET dans l'exemple `llms.txt`. Idéalement, ajouter une redirection/alias
`ritz-paris → hotel-ritz-paris` côté endpoint (tolérance slug) puisque
« ritz-paris » est le slug que tout LLM devinera spontanément.

### P1.2 — Décalage des compteurs annoncés vs réalité (crédibilité LLM)

| Surface     | llms.txt annonce   | Réalité endpoint/DB                          |
| ----------- | ------------------ | -------------------------------------------- |
| Classements | « 688 sélections » | `/api/agent/rankings` → `count: 704`         |
| Guides      | « 82 long-reads »  | 99 `editorial_guides` publiés (AGENTS.md)    |
| Catalogue   | « 2221 hôtels »    | 2219 publiés (AGENTS.md / `catalogue-stats`) |
| Lieux       | hub `/lieux`       | `/api/agent/cities` → `count: 1114`          |

Aucun n'est faux au point de tromper, mais un chiffre périmé entame la confiance
factuelle qu'on demande aux LLM d'accorder à MCH (et contredit le principe de
fraîcheur du skill). **Action** : brancher les compteurs de `llms.txt` sur la même
source que `lib/catalogue-stats.ts` / les endpoints `.jsonl` (génération dynamique
plutôt que littéraux).

---

## P2 — Optimisations de qualité (pas bloquant, ROI moyen)

### P2.1 — `llms.txt` pèse 400 KB (≈ 8× le budget < 50 KB du skill)

`llms.txt` inline ~1000 liens hôtels + 704 classements + 82 guides + 23 itinéraires

- marques + catégories. Le skill `geo-llm-optimization` réserve `llms.txt` au guide
  **concis** (« 5–10 liens curatés ») et délègue l'exhaustif à `llms-full.txt` /
  `hotels.jsonl`. Risque : certains fetchers LLM tronquent ou ignorent un `llms.txt`
  surdimensionné. **Action** : ramener `llms.txt` au set stratégique curaté (≤ 50 KB)
  et laisser `hotels.jsonl` + `rankings.jsonl` + `llms-full.txt` porter le catalogue
  complet (ils existent déjà et sont annoncés). C'est un choix de design assumé
  aujourd'hui ; à arbitrer.

### P2.2 — Entité `TravelAgency` : pas de `hasCredential` ni de `sameAs`

JSON-LD réel sur la fiche hôtel :

```json
{
  "@type": "TravelAgency",
  "name": "MyConciergeHotel",
  "@id": "https://myconciergehotel.com#organization",
  "award": "IATA accredited agency (FR)",
  "contactPoint": { "@type": "ContactPoint", "email": "contact@myconciergehotel.com" }
}
```

- La crédential IATA est portée par `award` (string) et non par le
  **`hasCredential`** structuré que prescrit le skill ; **ASPST/APST n'est pas
  dans le structured data** (mentionné seulement en prose).
- Pas de **`sameAs`** sur l'entité Organization/TravelAgency (aucun lien vers les
  profils sociaux / Wikidata de la marque) → réconciliation d'identité plus faible
  pour le Knowledge Graph et les LLM.

**Action** : ajouter `hasCredential` (IATA + APST en `EducationalOccupationalCredential`/
`Certification`) et `sameAs` (réseaux sociaux + page marque) sur le bloc
Organization. NAP cohérent côté `contactPoint` (email présent, ajouter téléphone +
`address` PostalAddress pour le NAP complet).

### P2.3 — Auteur éditorial de la fiche attribué à « Guide MICHELIN »

Sur la fiche `hotel-ritz-paris`, les 3 blocs `Article` JSON-LD portent
`"author":{"@type":"Organization","name":"Guide MICHELIN"}` et aucun byline
MyConciergeHotel / Concierge nommé n'est exposé en structured data
(`itemprop="author"` = 0). Le skill demande « author byline + bio sur chaque page
éditoriale ». **Action** : attribuer l'auteur principal à `MyConciergeHotel` (ou un
éditeur nommé) avec lien vers `/le-concierge/methode-editoriale` ; réserver
« Guide MICHELIN » aux blocs `citation`/`isBasedOn` (source), pas à `author`.

### P2.4 — Classement : ajouter la Q&A verbatim « Quels sont les meilleurs hôtels de {ville} ? »

Le pattern direct-answer est déjà **bon** : H1 (« Les meilleurs hôtels de Rome en
2026 ») + résumé factuel extractible + podium numéroté N°1…N°8 nommant les hôtels

- `ItemList` JSON-LD (8 `Hotel` nommés). Mais la **1re FAQ** est « Sur quels
  critères ce classement est-il établi ? », pas la formulation exacte que reçoivent
  les moteurs de réponse. **Action** : ajouter en tête de FAQ « Quels sont les
  meilleurs hôtels de {ville} ? » dont la réponse est la liste ordonnée — match
  verbatim de la requête d'acquisition.

---

## Ce qui est EXCELLENT (à préserver)

- **robots.txt** autorise explicitement tous les bots IA : `GPTBot`,
  `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`,
  `ClaudeBot`, `anthropic-ai`, `Applebot-Extended`, `MistralAI-User`,
  `Meta-ExternalAgent/Fetcher`, `Bytespider`, `Diffbot`, `Google-Extended`.
  (yonder n'autorise aucun bot IA nommément.)
- **llms.txt** présent, frais (`Dernière mise à jour : 2026-06-23`), titre scope
  mondial conforme ADR-0021 (« 127 pays », IATA), sections EEAT + API
  LLM-actionnables, cohérent « 28 compétences (26 endpoints) ».
- **28 agent-skills**, **26 endpoints testés résolvent tous en HTTP 200** avec
  payload cohérent : `hotel-sources` (Wikidata QID + confidence), `hotel`,
  `concierge-tip`, `cities` (1114), `rankings` (704), `ranking/{slug}`,
  `places-nearby`, `country-guide`, `directory/{pays}/{ville}`, `loyalty`.
  (`filter` + `booking` = intentions UI sans endpoint, documenté.)
- **FAQ** : les **10 questions canoniques** présentes en FR **et** EN (parking,
  petit-déj, wifi, animaux, distance aéroport, piscine, check-in anticipé,
  transferts, annulation, taxes) + opener, **1 seul** bloc `FAQPage` JSON-LD,
  réponses courtes citables.
- **EEAT / provenance** : bloc visible « Faits vérifiés » (année d'ouverture 1898
  _Wikidata_, architectes Charles Mewès / Jules Hardouin-Mansart) + « Références
  externes » (Wikidata, Wikipédia) + endpoint `/api/agent/hotel-sources/{slug}`
  avec `confidence` par claim.
- **Direct-answer ranking** : H1 + résumé factuel + podium nommé + `ItemList`
  JSON-LD → réponse extractible à « meilleurs hôtels de {ville} ».
- **Fraîcheur** : `dateModified` + `lastReviewed` dans le JSON-LD hôtel ; badge
  « Mise à jour 19 juin 2026 » visible.

---

## Benchmark vs yonder.fr (règle permanente)

| Critère                                      | MyConciergeHotel                                                         | yonder.fr                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `llms.txt`                                   | ✅ présent, 2026-06-23                                                   | ❌ **404**                                                                   |
| `/.well-known/agent-skills.json`             | ✅ 28 skills, 26 endpoints                                               | ❌ **403** (inexistant)                                                      |
| robots — bots IA autorisés nommément         | ✅ 13 bots                                                               | ❌ aucun bloc IA                                                             |
| JSON-LD page classement                      | `Article`+`ItemList`+`FAQPage`+8×`Hotel`+`BreadcrumbList`+`TravelAgency` | **`WebPage`+`BreadcrumbList` seulement** (0 FAQ, 0 ItemList hôtels, 0 Hotel) |
| FAQ structurée hôtel/classement              | ✅ FAQPage + 10 Q canoniques FR+EN                                       | ❌ aucune                                                                    |
| Endpoint EEAT/provenance                     | ✅ `/api/agent/hotel-sources`                                            | ❌ aucun                                                                     |
| **Citabilité Perplexity (réel, 2026-06-24)** | ❌ **0 / 4**                                                             | ✅ **3 / 4**                                                                 |

**Lecture** : MCH écrase yonder sur **toute** la dimension machine-lisible et
structurée — et perd néanmoins la seule métrique qui compte (citation réelle).
Cela **valide empiriquement** la thèse de la règle benchmark : l'écart n'est ni la
structure ni le JSON-LD (on est devant), c'est **l'autorité / l'indexation /
les backlinks**. Tant que ce verrou off-site n'est pas levé, la supériorité
structurelle de MCH reste un investissement non encore monétisé en GEO.

---

## Plan d'action priorisé (synthèse)

| Prio   | Action                                                                                                                  | Surface                             | Effort | Impact GEO                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ | -------------------------------------------- |
| **P0** | Finir indexation GSC (sitemap 2219) + programme backlinks/RP pour entrer dans les listes tierces lues par les LLM       | off-site / Phase 5                  | Élevé  | **Décisif** (seul levier de citation réelle) |
| **P0** | Re-tester les 4 requêtes Perplexity en KPI mensuel                                                                      | mesure                              | Faible | Pilotage                                     |
| **P1** | Corriger les slugs d'exemple `ritz-paris`→`hotel-ritz-paris` (manifeste + llms.txt) + alias slug tolérant côté endpoint | `agent-skills.json`, `/api/agent/*` | Faible | Moyen (actionnabilité agent)                 |
| **P1** | Brancher les compteurs llms.txt sur `catalogue-stats` / `.jsonl` (688→704, 82→99, 2221→2219)                            | `llms.txt`                          | Faible | Moyen (crédibilité)                          |
| **P2** | Trimmer `llms.txt` ≤ 50 KB, déléguer l'exhaustif à `*.jsonl` / `llms-full.txt`                                          | `llms.txt`                          | Moyen  | Faible                                       |
| **P2** | Ajouter `hasCredential` (IATA+APST) + `sameAs` + NAP complet sur l'entité Organization                                  | JSON-LD Org                         | Faible | Moyen (entité/KG)                            |
| **P2** | Auteur éditorial = MyConciergeHotel (pas « Guide MICHELIN ») + lien méthode                                             | JSON-LD `Article` fiche             | Faible | Faible-moyen (EEAT)                          |
| **P2** | FAQ classement : ajouter « Quels sont les meilleurs hôtels de {ville} ? » (réponse = liste ordonnée)                    | pages classement                    | Faible | Faible-moyen (match verbatim)                |

---

## Annexe — preuves (extraits réels)

- `llms.txt` titre : `# MyConciergeHotel.com — La sélection du Concierge — hôtels d'exception dans 127 pays. Agence IATA.` ; pied : `> Dernière mise à jour : 2026-06-23.` ; taille **400 381 octets**.
- `agent-skills.json` : `schemaVersion 0.1`, 28 skills, 26 avec `endpoint` (`filter`, `booking` sans endpoint).
- Endpoints 200 : `hotel-sources/hotel-ritz-paris` (Q656054, confidence high), `cities` (count 1114), `rankings` (count 704), `ranking/meilleurs-hotels-rome` (8 hôtels), `directory/france/paris`, `country-guide/japon`, `loyalty`, `places-nearby?hotelSlug=hotel-ritz-paris`.
- Endpoints 404 (slug d'exemple du manifeste) : `hotel-sources/ritz-paris`, `concierge-tip/ritz-paris`.
- FAQ fiche FR/EN : 10 Q canoniques + opener, 1 `FAQPage`.
- TravelAgency : `award:"IATA accredited agency (FR)"`, pas de `hasCredential`/`sameAs`.
- Article author fiche : `Organization "Guide MICHELIN"` (×3).
- Ranking Rome : H1 « Les meilleurs hôtels de Rome en 2026 » + lede factuel + podium N°1 Hotel de Russie / N°2 St. Regis Rome / … + `ItemList` (Hotel de Russie, St. Regis, Eden, Hassler, Six Senses, Bulgari, Palazzo Manfredi, Rome Cavalieri).
- robots.txt : 13 bots IA en `Allow: /`.
- Perplexity 2026-06-24 : MCH 0/4 ; yonder 3/4 ; travellers-society 1/4.
- yonder.fr : `llms.txt` 404, `agent-skills.json` 403, JSON-LD classement = `WebPage`+`BreadcrumbList` uniquement.
