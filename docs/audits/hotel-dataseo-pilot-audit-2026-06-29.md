# Audit pilote DataSEO — fiches hotels

**Date** : 2026-06-29
**Mode** : lecture seule, API DataForSEO/DataSEO live, aucune ecriture DB.
**Objectif** : valider la methode SEO/GEO/agentique avant un rollout fiche par
fiche sur le catalogue hotels.

## 0. Decision de methode

Toute fiche hotel doit etre auditee avec DataSEO avant retouche des titres,
meta descriptions, FAQ, `geo_qa`, `highlights` ou blocs AEO.

DataSEO n'est pas un audit autonome. Il est le **signal de demande** qui doit
etre croise avec les sources de verite du projet : skills, rules, CDC et code.
Une recommandation DataSEO qui contredit une hard rule projet est rejetee.

### Sources obligatoires avant chaque vague

| Couche | Source | Ce que l'audit doit en retenir |
| --- | --- | --- |
| CDC fiche hotel | `.cursor/rules/hotel-detail-page.mdc` | Parite Gordes, 15 blocs, FAQ Perplexity, photos, EEAT, avis Google, JSON-LD |
| SEO / GEO / AEO | `.cursor/rules/seo-geo.mdc` | metadata, canonical, hreflang, `llms.txt`, AEO, FAQ, factual summary |
| DataSEO | `.cursor/skills/keyword-grounding-dataforseo/SKILL.md` | PAA, related keywords, volumes, intent, `dfs_paa_coverage` |
| FAQ | `.cursor/rules/hotel-faq-perplexity.mdc` + skill FAQ | `faq_content_kit` 40-60, `faq_content` 10-15, `concierge_questions` 20-30 |
| SEO technique | `.cursor/skills/seo-technical/SKILL.md` | title, meta, canonical, hreflang, slugs, anti-cannibalisation |
| Schema.org | `.cursor/skills/structured-data-schema-org/SKILL.md` | `Hotel`, `FAQPage`, `ImageObject`, `AggregateRating /5`, pas d'`Offer` Phase 6 |
| Voix concierge | `EDITORIAL_VOICE.md` + `concierge-voice-pipeline` | ton, phrases courtes, pas de superlatifs creux, conseil concret |
| Benchmark | `.cursor/rules/competitor-benchmark-yonder.mdc` | comparer MCH a yonder/travellers quand la fiche touche SEO/acquisition |
| Securite / CSP | `.cursor/rules/security-csp.mdc` | JSON-LD via nonce, pas de script brut, pas de secret ni PII |
| Acceptation | `.cursor/rules/user-acceptance-before-commit.mdc` | toute modification visible doit etre marchee dans le navigateur avant commit |

### Code source a utiliser, pas a contourner

| Besoin | Fichier / runner |
| --- | --- |
| Appel API DataSEO | `packages/integrations/src/dataforseo/client.ts` |
| Volumes, PAA, intent | `packages/integrations/src/dataforseo/keyword-research.ts` |
| Config DataSEO | `scripts/editorial-pilot/src/grounding/env-dfs.ts` |
| Grounding hotel | `scripts/editorial-pilot/src/grounding/hotel-grounding.ts` |
| Grounding keywords / rendu prompt | `scripts/editorial-pilot/src/grounding/keyword-grounding.ts` |
| Probe fiche | `scripts/editorial-pilot/src/grounding/print-hotel-grounding.ts` |
| Coverage PAA | `scripts/editorial-pilot/src/hotels/faq-perplexity-gates.ts` |
| FAQ kit batch | `scripts/editorial-pilot/src/hotels/run-faq-perplexity-batch.ts` |
| Meta descriptions | `scripts/editorial-pilot/src/hotels/meta-desc-generator.ts` |
| Factual summary | `scripts/editorial-pilot/src/hotels/factual-summary-generator.ts` |
| GEO Q&A | `scripts/editorial-pilot/src/hotels/run-hotel-geo-qa.ts` |
| Audit CDC / scores | `scripts/editorial-pilot/src/hotels/hotel-fiche-cdc-gates.ts` |
| Rendu fiche | `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` |
| JSON-LD | `packages/seo/src/jsonld/*` + `apps/web/src/components/seo/json-ld.tsx` |
| Agentique | `packages/seo/src/agent-skills.ts`, `/llms.txt`, `/api/agent/hotel-*` |

### Regle de priorite

1. **Hard rules projet** : securite, booking Phase 6, CSP, JSON-LD, FAQ, parite
   EN, anti-scaffolding.
2. **CDC / parite Gordes** : niveau cible catalogue.
3. **DataSEO** : demande reelle, PAA, volumes, intent.
4. **LLM / editorial** : uniquement apres grounding, jamais comme source de
   questions ou de mots-cles inventes.

Le workflow retenu est :

1. Lire la fiche existante : `title`, `meta_desc`, `factual_summary`, FAQ,
   `faq_content_kit`, `concierge_questions`, `geo_qa`, POI, EEAT, photos.
2. Interroger DataSEO en FR et EN :
   - `keywords_data/google_ads/search_volume/live`
   - `dataforseo_labs/google/related_keywords/live`
   - `serp/google/organic/live/advanced`
3. Filtrer le bruit : celebrites, gossip, salaires, recrutement, questions hors
   intention hotel, people/culture web.
4. Aligner :
   - title / H1 sur la requete dominante utile ;
   - meta description sur l'intention qui convertit ;
   - FAQ visible sur les PAA utiles ;
   - `geo_qa` sur les questions avec vraie demande ;
   - `highlights` sur les sous-intentions detectees.
5. Recontroler `dfs_paa_coverage`, longueurs SEO, anti-scaffolding,
   JSON-LD visible et parite EN.

## 1. Lot pilote

| Slug | Pourquoi ce choix |
| --- | --- |
| `les-airelles-gordes` | Golden template et reference parite Gordes |
| `le-meurice` | Palace Paris, forte demande marque |
| `casa-labia` | Fiche texte OK mais zero photo / zero EEAT |
| `21-foch` | Fiche sans `geo_qa`, faible signal Google |
| `25hours-hotel-dubai-one-central` | Destination forte EN, requetes Dubai |
| `the-berkeley` | Londres, gros volume `luxury hotels London` |
| `aman-new-york` | New York, marque forte + destination tres volumique |

## 2. Resultats DataSEO exploitables

### `les-airelles-gordes`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `airelles gordes` | 2 400 | Requete marque principale |
| FR | `hotel gordes` | 880 | Intention destination concurrentielle |
| FR | `palace gordes` | 170 | Intention luxe qualifiee |
| EN | `Airelles Gordes` | 1 900 | Marque forte aussi en EN |
| EN | `best hotels Gordes` | 70 | Opportunite destination EN |

PAA utiles : proprietaire, chef, spa, aeroport proche, train vers Gordes.
PAA a filtrer : stars a Gordes, Marc Veyrat.

Action : garder le title marque + palace, mais renforcer les FAQ sur chef,
acces aeroport/train, spa et restaurant. Les recherches photo (`airelles gordes
la bastide photos` 480/mois) confirment que la galerie 30 photos est un actif
SEO central.

### `le-meurice`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `le meurice` | 40 500 | Enorme demande marque |
| FR | `le meurice restaurant` | 4 400 | Sous-intention F&B majeure |
| FR | `le meurice tea time` | 4 400 | Sous-intention exploitable |
| FR | `le meurice prix` | 480 | Prix, a traiter sans booking live |
| EN | `luxury hotels Paris` | 18 100 | Cluster destination a mailler |
| EN | `best hotels in Paris` | 12 100 | Cluster classement a mailler |
| EN | `Le Meurice` | 5 400 | Marque EN |

PAA utiles : prix par nuit, chef, menu, dress code, restaurant Michelin.
PAA a filtrer : salaires, Beyonce, Obama.

Action : la fiche doit mieux porter restaurant / tea time / dress code. La
destination Paris doit viser `luxury hotels Paris` et `best hotels in Paris`,
avec Le Meurice comme entite reliee, pas seulement comme fiche isolee.

### `casa-labia`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `casa labia` | 10 | Demande FR quasi nulle |
| EN | `Casa Labia` | 30 | Demande marque faible |
| EN | `Casa Labia hotel` | 10 | Intention hotel faible |

PAA utiles : type de cuisine, high tea, menu, fermeture / statut.
PAA a filtrer : Oaxaca, secret menu.

Action : ne pas surinvestir LLM sur du SEO generique. Priorite qualite :
photos, EEAT, statut exact, high tea / restaurant. `geo_qa` peut rester court
si DataSEO ne fournit pas de PAA utiles.

### `21-foch`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `hotel luxe angers` | 210 | Intention destination utile |
| FR | `21 foch angers` | 170 | Marque locale |
| FR | `hotel 5 etoiles angers` | 170 | Requete qualifiee |
| FR | `hotel boulevard foch angers` | 70 | Requete proximite |
| EN | `21 Foch Angers` | 10 | EN quasi nul |

PAA : aucune PAA pertinente detectee sur le seed principal. Related Searches :
avis, photos, boulevard Foch, concurrents locaux.

Action : ne pas inventer de `geo_qa` si PAA zero. Renforcer title/meta FR sur
`hotel luxe Angers` + `21 Foch Angers`, ajouter photos/avis, et traiter EN en
parite minimale.

### `25hours-hotel-dubai-one-central`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `25hours hotel dubai one central` | 170 | Marque faible mais claire |
| EN | `luxury hotels Dubai` | 8 100 | Cluster destination majeur |
| EN | `best hotels in Dubai` | 4 400 | Cluster classement |
| EN | `25hours hotel Dubai One Central` | 390 | Marque EN |

PAA utiles : specificite 25hours, proximite autour de One Central, etoiles.
PAA a filtrer : hotel 7 etoiles, Burj Al Arab, questions couple, gestes Dubai.

Action : la fiche doit se concentrer sur One Central, DIFC / Museum of the
Future / World Trade Centre, design lifestyle et prix indicatif non-booking.
Maillage obligatoire vers une page `luxury hotels Dubai`.

### `the-berkeley`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `the berkeley londres` | 320 | Marque FR |
| FR | `palace londres` | 260 | Intention luxe FR |
| EN | `luxury hotels London` | 22 200 | Cluster prioritaire |
| EN | `best hotels in London` | 9 900 | Cluster classement |
| EN | `The Berkeley London` | 1 900 | Marque EN |

PAA utiles : prix nuit, afternoon tea, restaurant, quartier/Knightsbridge.
PAA a filtrer : Justin Bieber, Taylor Swift, Meghan Markle, Johnny Cash.

Action : corriger la tonalite EN autour de London (eviter `Londres` dans les
surfaces EN), renforcer afternoon tea / rooftop / restaurant / Knightsbridge.
La fiche doit mailler une future page `luxury hotels London`.

### `aman-new-york`

| Langue | Requete | Volume/mois | Lecture |
| --- | --- | ---: | --- |
| FR | `aman new york` | 720 | Marque FR |
| FR | `hotel luxe new york` | 320 | Destination FR |
| EN | `luxury hotels New York` | 110 000 | Cluster massif |
| EN | `Aman New York` | 33 100 | Marque tres forte |
| EN | `5 star hotel New York` | 9 900 | Intention commerciale |
| EN | `best hotels in New York` | 8 100 | Cluster classement |

PAA utiles : dress code, proprietaire, club, restaurant, spa.
PAA a filtrer : celebrites, ultra-riches, clubs de membres generiques.

Action : priorite haute. La fiche Aman New York doit etre traitee comme page
phare EN : title/meta plus explicites, blocs spa / restaurant / jazz club,
photos, EEAT, et maillage vers `luxury hotels New York`.

## 3. Enseignements pour le catalogue

1. Les fiches hotel ont deux couches SEO distinctes :
   - **marque** : `Le Meurice`, `Aman New York`, `Airelles Gordes` ;
   - **destination** : `luxury hotels Paris/London/New York/Dubai`,
     `hotel luxe Angers`, `best hotels in Paris`.
2. Les PAA contiennent beaucoup de bruit. Le gate editorial doit filtrer :
   - celebrites ;
   - salaires/recrutement ;
   - gossip ;
   - questions hors hotel ;
   - questions prix si le booking live est requis pour repondre precisement.
3. Les petites fiches sans PAA utiles (`21-foch`, `casa-labia`) ne doivent pas
   recevoir de `geo_qa` invente. On renforce plutot photos, EEAT, avis et
   informations pratiques.
4. Les grandes destinations EN doivent guider le maillage :
   - `luxury hotels New York` : 110 000/mois ;
   - `luxury hotels London` : 22 200/mois ;
   - `luxury hotels Paris` : 18 100/mois ;
   - `luxury hotels Dubai` : 8 100/mois.
5. Les titres EN doivent etre audites pour les entites localisees : `London`,
   pas `Londres`, dans les surfaces EN.

## 4. Application par surface

| Surface | Signal DataSEO | Gate projet |
| --- | --- | --- |
| `meta_title_fr/en` | Requete utile la plus forte + entite hotel | 30-70 chars, unique, pas de keyword stuffing |
| `meta_desc_fr/en` | Intent commercial / informationnel + USP factuels | 140-170 chars, reflet exact de la page |
| H1 | Nom officiel + positionnement, pas phrase SEO forcee | Un seul H1, coherent avec title |
| H2 | Sous-intentions PAA utiles : restaurant, spa, acces, prix, quartier | Structure scannable, pas de H2 decoratif |
| `factual_summary` | Formulation haute demande, 3 USP verifiables | 110-165 prod, ideal 130-150, format CDC |
| `faq_content` | 10 canoniques + PAA utiles | 10-15, JSON-LD unique, first `<details open>` |
| `faq_content_kit` | PAA + related questions detaillees | 40-60, taxonomy, EN parity |
| `concierge_questions` | Intentions service / conciergerie utiles | 20-30, ton informatif, pas de "Je confirme" |
| `geo_qa` | PAA reellement presentes | skip si zero PAA utile, pas de LLM-only |
| `highlights` | Sous-intentions avec volume : spa, restaurant, vue, acces | pas de claims non sources |
| POI / acces | PAA "near", airport, train, district | distances / GPS / Place JSON-LD |
| EEAT | Requetes "owner", "chef", "Michelin", "reviews" | sources verifiables, external_sources >= 2 |
| Photos | Requetes photos / spa / room / restaurant | alt enrichi, ImageObject, pas de hotlink |
| JSON-LD | FAQ / rating / image / place visibles | nonce CSP, `bestRating: 5`, pas d'`Offer` Phase 6 |
| Agentique | Questions citees par LLM + payload API | `hotel-sources`, `hotel-photos`, `llms-full` non vides |

## 5. Benchmark concurrent obligatoire

Pour chaque destination ou fiche a enjeu SEO, l'audit doit ajouter une ligne
MCH vs yonder/travellers :

| Axe | A verifier |
| --- | --- |
| Coverage | Yonder couvre-t-il deja la destination / l'angle ? |
| Title / H1 | Leur pattern cible-t-il `hotel de luxe`, `best hotels`, `palace` ? |
| Richesse par hotel | Ont-ils architecte, chef, chambre a booker, anecdote ? |
| Structured data | Ont-ils moins de JSON-LD que MCH mais plus d'autorite ? |
| Hook commercial | Ont-ils un club / avantage / prix ? MCH doit rester Phase 6-safe |
| Delta MCH | Conseil du Concierge, FAQ PAA, JSON-LD superieur, catalogue mondial |

## 6. Definition of Done par fiche avant livraison

Une fiche ne doit pas etre marquee "livree" tant que :

- les seeds DataSEO FR + EN ont ete testes ;
- le title/meta/H1 ne contredisent pas la requete dominante ;
- les PAA utiles sont couvertes par FAQ ou `geo_qa` ;
- les PAA bruit sont explicitement ignorees ;
- `dfs_paa_coverage` est trace dans le runlog ;
- les longueurs SEO restent dans les bandes projet ;
- le contenu passe `hasLeak()`;
- la fiche conserve la parite EN ;
- l'EEAT a au moins deux sources exploitables ;
- les surfaces agentiques (`hotel-sources`, `hotel-photos`, `llms-full`) ne
  renvoient pas un payload vide ;
- pour les fiches kit, les gates `kit.*` sont verts et le walk Rule 6 est fait.

## 7. Rollout recommande

### Vague 1 — 50 fiches a fort potentiel

Prioriser :

1. marque + destination forte : Aman New York, Le Meurice, The Berkeley ;
2. capitales a gros volume EN : New York, London, Paris, Dubai, Rome ;
3. fiches deja visibles GSC ;
4. fiches sans `geo_qa` mais avec volume DataSEO.

### Vague 2 — trous qualite

Prioriser :

1. zero photo ;
2. zero EEAT ;
3. pas de Google rating ;
4. POI < 5 ;
5. `highlights` faibles.

### Vague 3 — catalogue long-tail

Traiter les petites fiches avec une regle de sobriete :

- si DataSEO renvoie zero PAA utile, ne pas generer de `geo_qa` artificiel ;
- renforcer uniquement les informations pratiques, la provenance et le maillage
  destination.

## 8. Commandes reproductibles

Test credentials DataSEO direct :

```bash
node - <<'NODE'
// Ne jamais commiter les credentials ; les injecter via variables d'environnement.
NODE
```

Runner repo cible quand `node_modules` est installe :

```bash
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=le-meurice --refresh
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --slugs=<slug> --grounded
pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-hotel-geo-qa.ts --slug=<slug>
```

## 9. Limites de ce pilote

- `node_modules` n'est pas installe dans ce Cloud, donc le CLI `tsx` du repo n'a
  pas ete execute.
- L'API DataSEO a ete testee en direct via `fetch` Node, avec credentials
  temporaires non ecrits dans le repo.
- Le pilote couvre 7 fiches, pas les 2 929 fiches publiees.
- Les volumes sont des snapshots DataSEO au 2026-06-29.
- L'AI keyword volume n'a pas ete teste dans ce pilote ; a ajouter si le compte
  DataSEO expose ce module.
