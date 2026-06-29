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

| Couche          | Source                                                 | Ce que l'audit doit en retenir                                                 |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| CDC fiche hotel | `.cursor/rules/hotel-detail-page.mdc`                  | Parite Gordes, 15 blocs, FAQ Perplexity, photos, EEAT, avis Google, JSON-LD    |
| SEO / GEO / AEO | `.cursor/rules/seo-geo.mdc`                            | metadata, canonical, hreflang, `llms.txt`, AEO, FAQ, factual summary           |
| DataSEO         | `.cursor/skills/keyword-grounding-dataforseo/SKILL.md` | PAA, related keywords, volumes, intent, `dfs_paa_coverage`                     |
| FAQ             | `.cursor/rules/hotel-faq-perplexity.mdc` + skill FAQ   | `faq_content_kit` 40-60, `faq_content` 10-15, `concierge_questions` 20-30      |
| SEO technique   | `.cursor/skills/seo-technical/SKILL.md`                | title, meta, canonical, hreflang, slugs, anti-cannibalisation                  |
| Schema.org      | `.cursor/skills/structured-data-schema-org/SKILL.md`   | `Hotel`, `FAQPage`, `ImageObject`, `AggregateRating /5`, pas d'`Offer` Phase 6 |
| Voix concierge  | `EDITORIAL_VOICE.md` + `concierge-voice-pipeline`      | ton, phrases courtes, pas de superlatifs creux, conseil concret                |
| Benchmark       | `.cursor/rules/competitor-benchmark-yonder.mdc`        | comparer MCH a yonder/travellers quand la fiche touche SEO/acquisition         |
| Securite / CSP  | `.cursor/rules/security-csp.mdc`                       | JSON-LD via nonce, pas de script brut, pas de secret ni PII                    |
| Acceptation     | `.cursor/rules/user-acceptance-before-commit.mdc`      | toute modification visible doit etre marchee dans le navigateur avant commit   |

### Code source a utiliser, pas a contourner

| Besoin                            | Fichier / runner                                                        |
| --------------------------------- | ----------------------------------------------------------------------- |
| Appel API DataSEO                 | `packages/integrations/src/dataforseo/client.ts`                        |
| Volumes, PAA, intent              | `packages/integrations/src/dataforseo/keyword-research.ts`              |
| Config DataSEO                    | `scripts/editorial-pilot/src/grounding/env-dfs.ts`                      |
| Grounding hotel                   | `scripts/editorial-pilot/src/grounding/hotel-grounding.ts`              |
| Grounding keywords / rendu prompt | `scripts/editorial-pilot/src/grounding/keyword-grounding.ts`            |
| Probe fiche                       | `scripts/editorial-pilot/src/grounding/print-hotel-grounding.ts`        |
| Coverage PAA                      | `scripts/editorial-pilot/src/hotels/faq-perplexity-gates.ts`            |
| FAQ kit batch                     | `scripts/editorial-pilot/src/hotels/run-faq-perplexity-batch.ts`        |
| Meta descriptions                 | `scripts/editorial-pilot/src/hotels/meta-desc-generator.ts`             |
| Factual summary                   | `scripts/editorial-pilot/src/hotels/factual-summary-generator.ts`       |
| GEO Q&A                           | `scripts/editorial-pilot/src/hotels/run-hotel-geo-qa.ts`                |
| Audit CDC / scores                | `scripts/editorial-pilot/src/hotels/hotel-fiche-cdc-gates.ts`           |
| Rendu fiche                       | `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`                       |
| JSON-LD                           | `packages/seo/src/jsonld/*` + `apps/web/src/components/seo/json-ld.tsx` |
| Agentique                         | `packages/seo/src/agent-skills.ts`, `/llms.txt`, `/api/agent/hotel-*`   |

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

| Slug                              | Pourquoi ce choix                                   |
| --------------------------------- | --------------------------------------------------- |
| `les-airelles-gordes`             | Golden template et reference parite Gordes          |
| `le-meurice`                      | Palace Paris, forte demande marque                  |
| `casa-labia`                      | Fiche texte OK mais zero photo / zero EEAT          |
| `21-foch`                         | Fiche sans `geo_qa`, faible signal Google           |
| `25hours-hotel-dubai-one-central` | Destination forte EN, requetes Dubai                |
| `the-berkeley`                    | Londres, gros volume `luxury hotels London`         |
| `aman-new-york`                   | New York, marque forte + destination tres volumique |

## 2. Resultats DataSEO exploitables

### `les-airelles-gordes`

| Langue | Requete              | Volume/mois | Lecture                               |
| ------ | -------------------- | ----------: | ------------------------------------- |
| FR     | `airelles gordes`    |       2 400 | Requete marque principale             |
| FR     | `hotel gordes`       |         880 | Intention destination concurrentielle |
| FR     | `palace gordes`      |         170 | Intention luxe qualifiee              |
| EN     | `Airelles Gordes`    |       1 900 | Marque forte aussi en EN              |
| EN     | `best hotels Gordes` |          70 | Opportunite destination EN            |

PAA utiles : proprietaire, chef, spa, aeroport proche, train vers Gordes.
PAA a filtrer : stars a Gordes, Marc Veyrat.

Action : garder le title marque + palace, mais renforcer les FAQ sur chef,
acces aeroport/train, spa et restaurant. Les recherches photo (`airelles gordes
la bastide photos` 480/mois) confirment que la galerie 30 photos est un actif
SEO central.

### `le-meurice`

| Langue | Requete                 | Volume/mois | Lecture                           |
| ------ | ----------------------- | ----------: | --------------------------------- |
| FR     | `le meurice`            |      40 500 | Enorme demande marque             |
| FR     | `le meurice restaurant` |       4 400 | Sous-intention F&B majeure        |
| FR     | `le meurice tea time`   |       4 400 | Sous-intention exploitable        |
| FR     | `le meurice prix`       |         480 | Prix, a traiter sans booking live |
| EN     | `luxury hotels Paris`   |      18 100 | Cluster destination a mailler     |
| EN     | `best hotels in Paris`  |      12 100 | Cluster classement a mailler      |
| EN     | `Le Meurice`            |       5 400 | Marque EN                         |

PAA utiles : prix par nuit, chef, menu, dress code, restaurant Michelin.
PAA a filtrer : salaires, Beyonce, Obama.

Action : la fiche doit mieux porter restaurant / tea time / dress code. La
destination Paris doit viser `luxury hotels Paris` et `best hotels in Paris`,
avec Le Meurice comme entite reliee, pas seulement comme fiche isolee.

### `casa-labia`

| Langue | Requete            | Volume/mois | Lecture                |
| ------ | ------------------ | ----------: | ---------------------- |
| FR     | `casa labia`       |          10 | Demande FR quasi nulle |
| EN     | `Casa Labia`       |          30 | Demande marque faible  |
| EN     | `Casa Labia hotel` |          10 | Intention hotel faible |

PAA utiles : type de cuisine, high tea, menu, fermeture / statut.
PAA a filtrer : Oaxaca, secret menu.

Action : ne pas surinvestir LLM sur du SEO generique. Priorite qualite :
photos, EEAT, statut exact, high tea / restaurant. `geo_qa` peut rester court
si DataSEO ne fournit pas de PAA utiles.

### `21-foch`

| Langue | Requete                       | Volume/mois | Lecture                     |
| ------ | ----------------------------- | ----------: | --------------------------- |
| FR     | `hotel luxe angers`           |         210 | Intention destination utile |
| FR     | `21 foch angers`              |         170 | Marque locale               |
| FR     | `hotel 5 etoiles angers`      |         170 | Requete qualifiee           |
| FR     | `hotel boulevard foch angers` |          70 | Requete proximite           |
| EN     | `21 Foch Angers`              |          10 | EN quasi nul                |

PAA : aucune PAA pertinente detectee sur le seed principal. Related Searches :
avis, photos, boulevard Foch, concurrents locaux.

Action : ne pas inventer de `geo_qa` si PAA zero. Renforcer title/meta FR sur
`hotel luxe Angers` + `21 Foch Angers`, ajouter photos/avis, et traiter EN en
parite minimale.

### `25hours-hotel-dubai-one-central`

| Langue | Requete                           | Volume/mois | Lecture                    |
| ------ | --------------------------------- | ----------: | -------------------------- |
| FR     | `25hours hotel dubai one central` |         170 | Marque faible mais claire  |
| EN     | `luxury hotels Dubai`             |       8 100 | Cluster destination majeur |
| EN     | `best hotels in Dubai`            |       4 400 | Cluster classement         |
| EN     | `25hours hotel Dubai One Central` |         390 | Marque EN                  |

PAA utiles : specificite 25hours, proximite autour de One Central, etoiles.
PAA a filtrer : hotel 7 etoiles, Burj Al Arab, questions couple, gestes Dubai.

Action : la fiche doit se concentrer sur One Central, DIFC / Museum of the
Future / World Trade Centre, design lifestyle et prix indicatif non-booking.
Maillage obligatoire vers une page `luxury hotels Dubai`.

### `the-berkeley`

| Langue | Requete                 | Volume/mois | Lecture             |
| ------ | ----------------------- | ----------: | ------------------- |
| FR     | `the berkeley londres`  |         320 | Marque FR           |
| FR     | `palace londres`        |         260 | Intention luxe FR   |
| EN     | `luxury hotels London`  |      22 200 | Cluster prioritaire |
| EN     | `best hotels in London` |       9 900 | Cluster classement  |
| EN     | `The Berkeley London`   |       1 900 | Marque EN           |

PAA utiles : prix nuit, afternoon tea, restaurant, quartier/Knightsbridge.
PAA a filtrer : Justin Bieber, Taylor Swift, Meghan Markle, Johnny Cash.

Action : corriger la tonalite EN autour de London (eviter `Londres` dans les
surfaces EN), renforcer afternoon tea / rooftop / restaurant / Knightsbridge.
La fiche doit mailler une future page `luxury hotels London`.

### `aman-new-york`

| Langue | Requete                   | Volume/mois | Lecture               |
| ------ | ------------------------- | ----------: | --------------------- |
| FR     | `aman new york`           |         720 | Marque FR             |
| FR     | `hotel luxe new york`     |         320 | Destination FR        |
| EN     | `luxury hotels New York`  |     110 000 | Cluster massif        |
| EN     | `Aman New York`           |      33 100 | Marque tres forte     |
| EN     | `5 star hotel New York`   |       9 900 | Intention commerciale |
| EN     | `best hotels in New York` |       8 100 | Cluster classement    |

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

| Surface               | Signal DataSEO                                                      | Gate projet                                            |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| `meta_title_fr/en`    | Requete utile la plus forte + entite hotel                          | 30-70 chars, unique, pas de keyword stuffing           |
| `meta_desc_fr/en`     | Intent commercial / informationnel + USP factuels                   | 140-170 chars, reflet exact de la page                 |
| H1                    | Nom officiel + positionnement, pas phrase SEO forcee                | Un seul H1, coherent avec title                        |
| H2                    | Sous-intentions PAA utiles : restaurant, spa, acces, prix, quartier | Structure scannable, pas de H2 decoratif               |
| `factual_summary`     | Formulation haute demande, 3 USP verifiables                        | 110-165 prod, ideal 130-150, format CDC                |
| `faq_content`         | 10 canoniques + PAA utiles                                          | 10-15, JSON-LD unique, first `<details open>`          |
| `faq_content_kit`     | PAA + related questions detaillees                                  | 40-60, taxonomy, EN parity                             |
| `concierge_questions` | Intentions service / conciergerie utiles                            | 20-30, ton informatif, pas de "Je confirme"            |
| `geo_qa`              | PAA reellement presentes                                            | skip si zero PAA utile, pas de LLM-only                |
| `highlights`          | Sous-intentions avec volume : spa, restaurant, vue, acces           | pas de claims non sources                              |
| POI / acces           | PAA "near", airport, train, district                                | distances / GPS / Place JSON-LD                        |
| EEAT                  | Requetes "owner", "chef", "Michelin", "reviews"                     | sources verifiables, external_sources >= 2             |
| Photos                | Requetes photos / spa / room / restaurant                           | alt enrichi, ImageObject, pas de hotlink               |
| JSON-LD               | FAQ / rating / image / place visibles                               | nonce CSP, `bestRating: 5`, pas d'`Offer` Phase 6      |
| Agentique             | Questions citees par LLM + payload API                              | `hotel-sources`, `hotel-photos`, `llms-full` non vides |

## 5. Benchmark concurrent obligatoire

Pour chaque destination ou fiche a enjeu SEO, l'audit doit ajouter une ligne
MCH vs yonder/travellers :

| Axe                | A verifier                                                          |
| ------------------ | ------------------------------------------------------------------- |
| Coverage           | Yonder couvre-t-il deja la destination / l'angle ?                  |
| Title / H1         | Leur pattern cible-t-il `hotel de luxe`, `best hotels`, `palace` ?  |
| Richesse par hotel | Ont-ils architecte, chef, chambre a booker, anecdote ?              |
| Structured data    | Ont-ils moins de JSON-LD que MCH mais plus d'autorite ?             |
| Hook commercial    | Ont-ils un club / avantage / prix ? MCH doit rester Phase 6-safe    |
| Delta MCH          | Conseil du Concierge, FAQ PAA, JSON-LD superieur, catalogue mondial |

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

## 10. Demarrage vague 1 — 2026-06-29 14:02 UTC

### Perimetre retenu

Le premier lot operationnel reste volontairement court : 12 fiches a fort enjeu
SEO/GEO, assez variees pour tester la methode sans consommer DataSEO a l'aveugle.

| Slug                                     | Raison prioritaire                                   |
| ---------------------------------------- | ---------------------------------------------------- |
| `les-airelles-gordes`                    | fiche golden / parite Gordes                         |
| `le-meurice`                             | palace Paris, fiche test canonique                   |
| `hotel-ritz-paris`                       | marque Paris a tres forte demande                    |
| `four-seasons-hotel-george-v`            | Paris, volume avis Google tres fort                  |
| `the-berkeley`                           | Londres, fiche test + cluster `luxury hotels London` |
| `claridge-s-londres`                     | Londres, marque Mayfair / afternoon tea              |
| `aman-new-york`                          | New York, demande EN massive                         |
| `the-plaza-hotel`                        | New York, icone Central Park                         |
| `25hours-hotel-dubai-one-central`        | Dubai lifestyle, fort volume avis                    |
| `burj-al-arab`                           | Dubai, icone + requete "7 etoiles" a cadrer          |
| `hotel-de-russie-rocco-forte-collection` | Rome, luxe + aperitivo / jardin                      |
| `bulgari-roma`                           | Rome, nouveau luxe + World's 50 Best                 |

### Etat DataSEO de reprise

Les credentials DataSEO n'ont pas ete persistes dans l'environnement, ni dans
un fichier `.env`, par securite. La reprise de session ne permet donc pas de
relancer les appels live sans reinjection temporaire des variables.

| Statut                                   | Fiches                                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DataSEO live deja verifie dans le pilote | `les-airelles-gordes`, `le-meurice`, `25hours-hotel-dubai-one-central`, `the-berkeley`, `aman-new-york`                                                              |
| A sonder des reinjection credentials     | `hotel-ritz-paris`, `four-seasons-hotel-george-v`, `claridge-s-londres`, `the-plaza-hotel`, `burj-al-arab`, `hotel-de-russie-rocco-forte-collection`, `bulgari-roma` |

Aucune recommandation de volume n'est inventee pour les 7 fiches non sondees
live. Elles sont auditees ci-dessous sur les gates projet + ecarts visibles,
puis marquees comme `DataSEO pending`.

### Snapshot Supabase du lot 1

| Slug                                     | SEO actuel                      | FAQ/GEO       |       Photos | EEAT | Lecture                                                    |
| ---------------------------------------- | ------------------------------- | ------------- | -----------: | ---: | ---------------------------------------------------------- | ------------------------------------ |
| `les-airelles-gordes`                    | title 63, meta 165, factual 130 | FAQ 10, GEO 3 | 30 / 11 cat. |    9 | conforme golden ; a garder stable                          |
| `le-meurice`                             | title 44, meta 149, factual 141 | FAQ 15, GEO 3 |  10 / 5 cat. |    2 | DataSEO demande restaurant / tea time sous-exploitee       |
| `hotel-ritz-paris`                       | title 44, meta 150, factual 139 | FAQ 15, GEO 3 |  12 / 2 cat. |   13 | photos trop peu diversifiees ; libelle "Palace" a verifier |
| `four-seasons-hotel-george-v`            | title 61, meta 162, factual 138 | FAQ 15, GEO 3 |  11 / 2 cat. |    8 | contenu solide ; photo coverage faible                     |
| `the-berkeley`                           | title 48, meta 144, factual 119 | FAQ 15, GEO 3 |  10 / 3 cat. |    4 | factual sous ideal ; "Palace Londres" a cadrer             |
| `claridge-s-londres`                     | title 44, meta 141, factual 132 | FAQ 15, GEO 3 |  10 / 3 cat. |   10 | meta trop generique pour Mayfair / afternoon tea           |
| `aman-new-york`                          | title 48, meta 148, factual 131 | FAQ 15, GEO 3 |  10 / 6 cat. |    3 | DataSEO EN massif ; title/meta trop prudents               |
| `the-plaza-hotel`                        | title 52, meta 158, factual 135 | FAQ 15, GEO 3 |  20 / 5 cat. |   10 | bonne base ; exploiter Central Park / Palm Court           |
| `25hours-hotel-dubai-one-central`        | title 46, meta 167, factual 146 | FAQ 15, GEO 3 |  12 / 8 cat. |    8 | title casse (`                                             | ` final) ; bon sujet Dubai lifestyle |
| `burj-al-arab`                           | title 53, meta 148, factual 141 | FAQ 15, GEO 3 |  10 / 3 cat. |   11 | GEO traite "7 etoiles" ; meta trop publicitaire            |
| `hotel-de-russie-rocco-forte-collection` | title 46, meta 168, factual 143 | FAQ 15, GEO 3 |  10 / 5 cat. |    1 | EEAT faible ; jardin / aperitivo a sourcer                 |
| `bulgari-roma`                           | title 43, meta 161, factual 134 | FAQ 15, GEO 3 |  17 / 6 cat. |    6 | FAQ FR contient une question en italien                    |

### Audit fiche par fiche

#### `les-airelles-gordes`

- **Decision** : ne pas retoucher la structure ; elle reste la reference.
- **DataSEO verifie** : `airelles gordes` 2 400 FR, `hotel gordes` 880 FR,
  `Airelles Gordes` 1 900 EN.
- **Action** : uniquement enrichissement fin si une nouvelle vague FAQ est
  lancee : chef, acces train/aeroport, spa Guerlain, restaurant.
- **Gate** : photos 30 et 11 categories OK ; EEAT OK ; pas d'urgence.

#### `le-meurice`

- **DataSEO verifie** : `le meurice` 40 500 FR, `le meurice restaurant`
  4 400 FR, `le meurice tea time` 4 400 FR, `luxury hotels Paris` 18 100 EN.
- **Ecart** : FAQ operationnelle trop centree check-in / late check-out ; les
  sous-intentions restaurant, tea time, dress code et chef meritent le kit FAQ.
- **Action** : regenerer `faq_content_kit` / `geo_qa` avec PAA restaurant
  et tea time ; renforcer photos restaurant/spa ; consolider EEAT au-dela de 2
  sources.
- **Gate** : ne pas donner de prix exact tant que Phase 6 booking est gelee.

#### `hotel-ritz-paris`

- **DataSEO** : pending live.
- **Ecart** : `photo_count=12` mais seulement 2 categories ; la fiche ne peut
  pas rivaliser visuellement avec les requetes photos / spa / chambre.
- **Action** : sonder `ritz paris`, `ritz paris spa`, `ritz paris restaurant`,
  `ritz paris bar hemingway`, puis aligner FAQ/GEO sur spa, table, Place
  Vendome et acces.
- **Gate** : verifier le mot `Palace` contre la source officielle avant de le
  garder en title/meta si `is_palace=false`.

#### `four-seasons-hotel-george-v`

- **DataSEO** : pending live.
- **Ecart** : title/meta/factual sont dans les bandes ; la faiblesse est photo
  (`11` images, `2` categories) et la couverture F&B precise.
- **Action** : sonder `george v paris`, `four seasons george v restaurant`,
  `le cinq paris`, puis enrichir FAQ/PAA chef, Michelin, spa et Arc de
  triomphe.
- **Gate** : eviter le keyword stuffing "Michelin" ; garder uniquement les
  faits sources.

#### `the-berkeley`

- **DataSEO verifie** : `luxury hotels London` 22 200 EN, `best hotels in
London` 9 900 EN, `The Berkeley London` 1 900 EN, `palace londres` 260 FR.
- **Ecart** : `factual_summary_fr` 119 caracteres, dans l'enveloppe mais sous
  l'ideal CDC ; photos et EEAT moyens ; label `Palace Londres` a cadrer.
- **Action** : renforcer Knightsbridge, afternoon tea, restaurant, Surrenne spa
  et maillage classement Londres.
- **Gate** : EN doit dire `London`, pas `Londres`, dans title/meta visibles.

#### `claridge-s-londres`

- **DataSEO** : pending live.
- **Ecart** : meta generique ("cadre raffine", "service de qualite") trop
  faible face a Yonder ; manque Mayfair, Art Deco, afternoon tea, chef/bar.
- **Action** : sonder `claridge's london`, `claridge's afternoon tea`,
  `claridge's restaurant`, puis rewriter meta/FAQ sans superlatif.
- **Gate** : ne pas conserver `palace_atout_france` comme signal public pour un
  hotel londonien sans base Atout France.

#### `aman-new-york`

- **DataSEO verifie** : `luxury hotels New York` 110 000 EN, `Aman New York`
  33 100 EN, `5 star hotel New York` 9 900 EN, `aman new york` 720 FR.
- **Ecart** : title/meta trop generiques pour un actif EN majeur ; `external_sources=3`
  seulement pour une fiche qui doit servir de pilier New York.
- **Action** : renforcer spa, restaurant, jazz club, Fifth Avenue, World's 50
  Best et maillage `luxury hotels New York`.
- **Gate** : filtrer PAA celebrites / club prive generique.

#### `the-plaza-hotel`

- **DataSEO** : pending live.
- **Ecart** : bonne base EEAT/photos, mais les categories photo restent limitees
  et la FAQ doit capter Central Park, Palm Court, afternoon tea, Landmark.
- **Action** : sonder `plaza hotel new york`, `the plaza afternoon tea`,
  `plaza hotel central park`, puis reclasser les PAA utiles entre FAQ et GEO.
- **Gate** : verifier `Palace New York` en title ; privilegier "hotel iconique"
  si l'usage est non officiel.

#### `25hours-hotel-dubai-one-central`

- **DataSEO verifie** : `luxury hotels Dubai` 8 100 EN, `best hotels in Dubai`
  4 400 EN, `25hours hotel Dubai One Central` 390 EN.
- **Ecart** : title casse visuellement (`|` final) ; opportunite claire sur One
  Central / DIFC / Museum of the Future / World Trade Centre.
- **Action** : corriger title, renforcer FAQ "quartier", "accès", "design
  lifestyle" et maillage Dubai.
- **Gate** : ne pas laisser les PAA Burj Al Arab polluer cette fiche lifestyle.

#### `burj-al-arab`

- **DataSEO** : pending live.
- **Ecart** : meta trop promotionnelle ("experience unique") ; photos peu
  diversifiees ; GEO traite deja correctement "hotel 7 etoiles".
- **Action** : sonder `burj al arab`, `burj al arab 7 star`, `burj al arab
restaurant`, `burj al arab visit`, puis enrichir les reponses "entrer sans
  sejourner" et "budget" sans prix invente.
- **Gate** : ne jamais valider "7 etoiles" comme classification officielle.

#### `hotel-de-russie-rocco-forte-collection`

- **DataSEO** : pending live.
- **Ecart** : `external_sources=1`, trop bas pour Forbes Five-Star ; meta en
  limite haute ; photos categories modestes.
- **Action** : sonder `hotel de russie rome`, `hotel de russie garden`,
  `hotel de russie aperitivo`, puis sourcer jardin, Stravinskij Bar, Piazza del
  Popolo et Villa Borghese.
- **Gate** : EEAT >= 2 sources avant toute retouche editorialisee.

#### `bulgari-roma`

- **DataSEO** : pending live.
- **Ecart** : FAQ FR contient une question italienne (`Dove si trova Bulgari a
Roma?`) ; meta generique pour une fiche World's 50 Best.
- **Action** : corriger la langue FAQ, sonder `bulgari hotel rome`, `bulgari
roma restaurant`, `bulgari rome spa`, puis renforcer design, restaurant et
  localisation.
- **Gate** : la parite FR/EN passe avant tout enrichissement SEO.

### Benchmark yonder / travellers — lot 1

Yonder couvre deja des angles Paris et Londres avec des pages tres narratives :
Le Meurice dans "les plus beaux hotels du monde", palaces des Champs-Elysees,
Cheval Blanc Paris, Mandarin Oriental Mayfair. Leur force est l'autorite
editoriale et l'anecdote longue. MCH garde l'avantage machine : FAQ PAA, GEO
Q&A, JSON-LD plus riche, `hotel-sources`, `hotel-photos`, maillage catalogue.

Delta actionnable pour la vague 1 :

1. **Battre Yonder sur les reponses** : PAA visibles, `geo_qa`, FAQ JSON-LD.
2. **Rattraper Yonder sur le detail concret** : chef, spa, chambre a demander,
   bar, quartier, acces.
3. **Ne pas copier leur style magazine** : garder la voix Concierge, precise et
   operationnelle.
4. **Ne pas publier sans walk** : toute retouche title/meta/FAQ visible doit
   etre verifiee depuis `/hotel/<slug>` et `/en/hotel/<slug>`.

### Prochaine etape de production

1. Reinjecter temporairement `DATAFORSEO_ENABLED=1`, `DATAFORSEO_USERNAME` et
   `DATAFORSEO_PASSWORD` dans la session, sans ecriture fichier.
2. Lancer `print-hotel-grounding.ts --slug=<slug> --refresh` sur les 7 fiches
   `DataSEO pending`.
3. Calculer `dfs_paa_coverage` avant tout rewrite.
4. Ecrire un patch de contenu fiche par fiche, en commencant par les corrections
   non ambigues : `25hours` title casse, `bulgari-roma` question italienne,
   EEAT faible `hotel-de-russie`, photos categories faibles sur Ritz / George V.

## 11. Plan complet DataSEO — mode local API-ready

Ce plan remplace le mode "audit pilote" des que le poste local dispose des API :
DataForSEO, Supabase, OpenAI/Perplexity, Tavily, Cloudinary et Vercel. Le
principe reste strict : **aucune fiche n'est reecrite sans grounding DataSEO et
aucun signal DataSEO n'ecrase une hard rule projet**.

### 11.1 Preflight local obligatoire

Avant toute vague :

1. Se placer sur la branche de travail :
   - `git checkout cursor/dataseo-hotel-audit-7688`
   - `git pull origin cursor/dataseo-hotel-audit-7688`
2. Charger les variables en local, sans les commiter :
   - `DATAFORSEO_ENABLED=1`
   - `DATAFORSEO_USERNAME`
   - `DATAFORSEO_PASSWORD`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` / provider LLM utilise par les runners
3. Verifier l'acces DataSEO sur une fiche test :
   - `pnpm --filter @mch/editorial-pilot exec tsx src/grounding/probe-dfs.ts`
   - `pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=le-meurice --refresh`
4. Verifier que le cache ecrit dans `data/dfs-cache/` et non dans le repo
   applicatif. Le cache peut etre conserve localement pour eviter les doubles
   couts, mais il ne doit pas contenir de secret.
5. Verifier les gates de base :
   - `pnpm --filter @mch/editorial-pilot test -- scaffolding-gate`
   - `pnpm --filter @mch/editorial-pilot test -- faq-perplexity-gates`

### 11.2 Extraction de base par vague

Chaque vague commence par un export Supabase, avant DataSEO :

| Donnee                                                  | Pourquoi                                          |
| ------------------------------------------------------- | ------------------------------------------------- |
| `meta_title_fr/en`, `meta_desc_fr/en`                   | verifier longueur, unicite, requete cible         |
| `factual_summary_fr/en`                                 | verifier envelope 110-165 et ideal 130-150        |
| `faq_content`, `faq_content_kit`, `concierge_questions` | mesurer couverture PAA et canoniques              |
| `geo_qa`                                                | verifier si les 3 reponses suivent les vraies PAA |
| `long_description_sections`                             | verifier H2, sections spa/restaurant/quartier     |
| `external_sources`                                      | EEAT, chef, architecte, label, Michelin, Forbes   |
| `gallery_images`                                        | categories, alt, requetes photo, ImageObject      |
| `google_rating`, `google_reviews_count`                 | signaux confiance + AggregateRating /5            |
| `updated_at`                                            | fraicheur et ordre de revalidation                |

Sortie attendue : un fichier par vague dans `docs/audits/` ou
`scripts/editorial-pilot/runs/` avec la liste des slugs, les scores, et les
champs a toucher.

### 11.3 Requetes DataSEO par fiche

Pour chaque fiche, interroger au minimum ces familles de seeds :

| Famille                | Exemples                                                      | Usage                             |
| ---------------------- | ------------------------------------------------------------- | --------------------------------- |
| Marque                 | `<hotel>`, `<hotel> <ville>`                                  | title, meta, FAQ marque           |
| Destination luxe       | `hotel luxe <ville>`, `luxury hotels <city>`                  | maillage classement / destination |
| Intention booking-safe | `<hotel> prix`, `<hotel> room rate`                           | reponse sans prix invente         |
| F&B                    | `<hotel> restaurant`, `<hotel> chef`, `<hotel> afternoon tea` | FAQ, H2, highlights               |
| Spa / bien-etre        | `<hotel> spa`, `<hotel> piscine`                              | FAQ, photos, H2                   |
| Acces / quartier       | `<hotel> airport`, `<hotel> near <poi>`                       | `geo_qa`, POI, FAQ                |
| Images                 | `<hotel> photos`, `<hotel> rooms photos`                      | priorisation photo / alt          |
| Reputation             | `<hotel> reviews`, `<hotel> Michelin`, `<hotel> Forbes`       | EEAT + JSON-LD                    |

Endpoints a utiliser via le package `packages/integrations/src/dataforseo/` :

1. `keywords_data/google_ads/search_volume/live` pour les volumes.
2. `dataforseo_labs/google/related_keywords/live` pour les clusters.
3. `dataforseo_labs/google/search_intent/live` pour l'intention.
4. `serp/google/organic/live/advanced` pour PAA, related searches et concurrents.
5. `ai_keyword_volume` seulement si le compte DataSEO expose le module.

### 11.4 Filtrage editorial obligatoire

Les PAA sont une source de demande, pas un brief a recopier. Chaque PAA doit
etre classee :

| Classe           | Action                                                      |
| ---------------- | ----------------------------------------------------------- |
| `keep_faq`       | question utile pour `faq_content_kit` ou FAQ visible        |
| `keep_geo`       | question courte et locale pour `geo_qa`                     |
| `keep_section`   | sous-intention a traiter en H2 ou paragraphe                |
| `keep_linking`   | maillage vers classement, destination, guide ou POI         |
| `reject_noise`   | celebrity, gossip, salaire, recrutement, biographie, people |
| `reject_phase6`  | prix exact, disponibilite, stock, offre, paiement           |
| `reject_unknown` | fait non source ou juridiquement risqué                     |

Regle dure : si DataSEO renvoie zero PAA utile, on **ne genere pas** de `geo_qa`
LLM-only. On renforce seulement title/meta, provenance, photos et maillage.

### 11.5 Ordre d'intervention par fiche

1. **Corriger les erreurs non ambigues** : langue incorrecte, title casse,
   longueur hors bande, source manquante, claim interdit.
2. **Re-ground FAQ kit** avec `run-faq-perplexity-batch.ts --grounded`.
3. **Recalculer `dfs_paa_coverage`** avec `evaluatePaaCoverage`.
4. **Regenerer `geo_qa`** uniquement si PAA utile.
5. **Reviser title/meta/factual_summary** seulement si le signal DataSEO
   change la requete principale ou l'intention.
6. **Renforcer sections longues** si une sous-intention forte manque :
   restaurant, spa, chambre signature, quartier, acces.
7. **Completer EEAT** avant d'ajouter un fait nouveau : chef, architecte,
   classement, label, ouverture, prix culturel.
8. **Prioriser photos** quand DataSEO montre une demande photo et que la fiche
   a moins de 10 categories ou moins de 30 photos.
9. **Verifier JSON-LD / agentique** : FAQPage, ImageObject, AggregateRating /5,
   `hotel-sources`, `hotel-photos`, `llms-full`.
10. **Walk user-visible** avant commit pour toute retouche visible.

### 11.6 Vagues de production

| Vague | Slugs / surface                     | Objectif                                             |
| ----- | ----------------------------------- | ---------------------------------------------------- |
| 1A    | les 12 slugs du lot 1               | finir DataSEO pending + corrections non ambigues     |
| 1B    | top 50 marque + capitale            | Paris, Londres, New York, Dubai, Rome, Venise, Tokyo |
| 2     | fiches avec `external_sources < 2`  | EEAT et source gaps avant rewrite                    |
| 3     | fiches avec photo gap               | moins de 30 photos ou moins de 10 categories         |
| 4     | fiches avec factual/meta hors ideal | SEO bands + PAA coverage                             |
| 5     | long-tail sans PAA utile            | sobriete : infos pratiques, sources, maillage        |
| 6     | rankings / guides lies              | maillage destination et anti-cannibalisation         |

Chaque vague doit produire :

- un runlog avec `grounding=on/off`, locale DataSEO, nombre de PAA utiles,
  `dfs_paa_coverage`, skips et cout approximatif ;
- une table `before/after` par fiche ;
- un fichier rollback ou snapshot DB redige sans secret ni PII, stocke dans un
  chemin ignore comme `scripts/editorial-pilot/runs/` quand une ecriture a lieu ;
- une liste "a ne pas traiter" quand DataSEO est trop faible ou bruite.

### 11.7 Definition of Done locale

Une fiche sort de la vague seulement si :

- DataSEO FR + EN a ete execute ou explicitement marque `no_paa_useful` ;
- les PAA utiles sont couvertes par FAQ, `geo_qa`, section ou maillage ;
- les PAA rejetees sont listees avec raison ;
- `dfs_paa_coverage` est trace ;
- `hasLeak()` passe sur toutes les sorties LLM ;
- les titres et metas restent dans les bandes projet ;
- la voix Concierge respecte `EDITORIAL_VOICE.md` ;
- aucune info Phase 6 n'est inventee : prix exact, disponibilite, offre,
  `priceValidUntil`, urgence, paiement ;
- EEAT couvre les faits nouveaux ;
- FR et EN restent coherents ;
- le rendu est marche depuis `/hotel/<slug>` et `/en/hotel/<slug>` si visible.

### 11.8 Commandes de vague 1A

Ordre recommande en local :

```bash
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=hotel-ritz-paris --refresh
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=four-seasons-hotel-george-v --refresh
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=claridge-s-londres --refresh
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=the-plaza-hotel --refresh
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=burj-al-arab --refresh
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=hotel-de-russie-rocco-forte-collection --refresh
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug=bulgari-roma --refresh
```

Puis, seulement apres lecture humaine des PAA :

```bash
pnpm --filter @mch/editorial-pilot faq:perplexity:batch -- --slugs=hotel-ritz-paris,four-seasons-hotel-george-v,claridge-s-londres,the-plaza-hotel,burj-al-arab,hotel-de-russie-rocco-forte-collection,bulgari-roma --grounded
pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-hotel-geo-qa.ts --slug=<slug> --dry-run
```

`--dry-run` est obligatoire sur `geo_qa` avant ecriture, car la surface est
visible et ne doit jamais inventer une question quand DataSEO est silencieux.
