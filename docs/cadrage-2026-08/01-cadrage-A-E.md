# Cadrage A → E — le plan maître

> Comment on repart, en cinq phases, avec ce qu'on a déjà.

---

## 1. Diagnostic — les faits, pas les impressions

Toutes les mesures ci-dessous sont datées et sourcées dans le dépôt. Aucune
n'est une estimation.

| Ce qu'on a construit                                                                  | Ce que ça produit                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2 219 hôtels publiés dans 127 pays, jusqu'à 20 blocs JSON-LD par fiche                | **1 mot-clé classé** sur Google FR (yonder.fr : 14 727)        |
| 8 202 URLs soumises, 7 familles de sitemaps avec alternates                           | **191 pages avec impressions (2,3 %)**                         |
| 863 classements, 79 guides, 1 158 lieux, itinéraires                                  | **0/12** du panier de requêtes cibles dans le top 20           |
| Surface agent unique au secteur (llms.txt, hotels.jsonl, 26 endpoints `/api/agent/*`) | non mesurée — aucune instrumentation de citation               |
| Un tunnel de réservation, 4 connecteurs GDS/inventaire, un programme de fidélité      | **bouton « Réserver » désactivé sur la majorité du catalogue** |
| 374 scripts éditoriaux, 78 migrations, 48 skills, 30 règles, 241 documents            | **0 € de revenu**, un fondateur seul                           |

**Le diagnostic tient en une phrase : la machine est excellente, elle tourne à
vide, et elle est devenue trop lourde pour une seule personne.**

Trois causes, dans cet ordre :

1. **Aucune autorité.** Le domaine n'a essentiellement pas de liens entrants.
   Aucune optimisation on-page ne compense un profil de liens vide — c'est le
   constat déjà posé le 2 juillet, et la décision D4 (outreach reporté) l'a
   laissé intact depuis.
2. **Le budget de crawl part dans le vide.** Google indexe
   `/destination/dommeldange` (1 hôtel) pendant que `le-meurice` reste
   « Discovered, not indexed ». On a publié de la surface avant d'avoir gagné
   le droit d'être crawlé large.
3. **Rien ne convertit.** Le seul revenu possible aujourd'hui — la demande
   concierge — n'est ni instrumenté, ni universellement accessible. Le CTA
   principal du site est mort sur la plupart des pages.

Et une cause de fond qui aggrave les trois : **la surface de maintenance
dépasse la capacité d'exécution.** Sept verticales éditoriales, deux templates
de fiche concurrents, 374 scripts dont plusieurs pipelines legacy non conformes
aux règles actuelles, 51 Mo d'artefacts de design versionnés, 46 audits datés
présentés au même niveau que la documentation vivante. Chaque session d'agent
paie le coût de cette surface avant d'écrire une ligne utile.

### Ce qui a déjà bien marché — à ne pas casser

Le recadrage n'est pas une remise en cause du travail accompli. Trois acquis
sont **supérieurs au marché** et doivent être défendus :

- **La couche machine** (JSON-LD, hreflang, canonicals, sitemaps, surface
  agent). C'est la douve réelle, et elle est déjà creusée.
- **Le layering** (`domain` pur → `integrations` → apps) tenu sans triche,
  vérifié par échantillonnage à l'audit du 2 juillet.
- **La méthode de contenu** : grounding DataForSEO obligatoire + gate
  `hasLeak()` anti-scaffolding. C'est ce qui empêche le corpus de devenir du
  remplissage. Elle reste une hard rule.

Et un acquis technique récent, décisif, qu'il faut connaître avant de replanifier
la performance : **ADR-0031 (2026-07-02) a tranché la question du cache sur
preuve**. Le cache HTML CDN est **structurellement impossible** tant que la CSP
porte un nonce par requête (Next.js n'estampille pas de nonce dans du HTML
prérendu, et sous `strict-dynamic` le navigateur bloque alors _tous_ les
scripts — c'est mesuré, les 4 pages légales `force-static` étaient en production
avec zéro JavaScript fonctionnel). Le levier a donc été déplacé vers le **Data
Cache** (`unstable_cache`), avec des gains mesurés massifs : home 2 752 →
114 ms, `/destination/paris` 20 700 → 113 ms, classement 10 623 → 620 ms. **La
performance n'est plus le goulot n°1 du projet.** Toute replanification qui
remettrait « réactiver l'ISR » en tête de liste rejouerait une question déjà
close.

---

## 2. La thèse du recadrage

> On ne construit plus de surface nouvelle. On **rétrécit le produit jusqu'à ce
> qu'il tienne dans la main d'une personne**, on prouve qu'il capte de la demande
> sur un périmètre étroit, et on ne rouvre la largeur qu'après cette preuve.

Trois paris explicites, à assumer ou à refuser maintenant :

**Pari 1 — Le catalogue est un actif, pas un chantier.** 2 219 fiches
existent ; elles ne seront plus retouchées en masse. On investit sur les
~150 fiches et ~50 classements qui ont une chance réelle d'être vus, et on laisse
le reste en l'état, indexé ou non selon la règle de crawl-focus. Corollaire
assumé : **la complétude horizontale « niveau Gordes sur les 2 221 », décidée le
17 juin, est abandonnée.** C'est le changement de cap le plus important de ce
document, et il doit être arbitré explicitement (A0-2).

**Pari 2 — Sans autorité, rien ne décolle ; l'autorité ne s'automatise pas.**
La décision D4 (2 juillet, outreach reporté) était une décision de confort qui
a coûté un mois. Ou bien le PO engage un effort d'outreach humain récurrent —
quelques heures par semaine, tenues —, ou bien on acte que le trafic organique
ne décollera pas et on cherche la demande ailleurs (SEA, partenariats, réseaux).
Les deux sont acceptables ; **l'ambiguïté ne l'est pas** (A0-3).

**Pari 3 — Un euro de revenu prouvé vaut mille pages publiées.** La priorité
passe de « publier » à « capter et mesurer une demande ». La demande concierge
par e-mail est le seul revenu accessible sans dégeler le booking : elle devient
le KPI central de la Phase D, avant tout objectif de trafic.

---

## 3. Le produit, redéfini en une page

**MyConciergeHotel.com est un média éditorial de référence sur l'hôtellerie
d'exception, qui monétise la mise en relation.** Ce n'est pas une OTA — pas
encore. L'accréditation IATA et l'infrastructure de réservation sont des actifs
de la Phase E, pas la proposition de valeur d'aujourd'hui.

| Question                           | Réponse verrouillée                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pour qui ?**                     | Un voyageur qui a le budget d'un hôtel d'exception et pas le temps de trier — et, de plus en plus, **l'IA à qui il délègue ce tri**                           |
| **Quelle promesse ?**              | La sélection du Concierge : une fiche plus complète et plus honnête que partout ailleurs, avec le **conseil opérationnel** que les guides ne donnent jamais   |
| **Quelle preuve ?**                | Chaque affirmation est sourcée ou retirée. Zéro brodage. Le gate `hasLeak()` et le grounding DataForSEO sont la garantie industrielle de cette promesse       |
| **Comment on gagne de l'argent ?** | **Aujourd'hui** : demande concierge → réservation traitée manuellement, commission agence. **Demain (Phase E)** : réservation en ligne sur un périmètre borné |
| **Contre qui ?**                   | yonder.fr sur le référencement classique ; ChatGPT / Perplexity / Google AI comme **canal**, pas comme concurrent — d'où la surface agent                     |
| **Qu'est-ce qu'on ne fait pas ?**  | Ni comparateur de prix généraliste, ni marketplace, ni application mobile, ni locales au-delà de FR/EN, avant la preuve de la Phase D                         |

---

## 4. Les 5 phases

```
A ─ Vérité & réduction de surface      S1-S2    ██
B ─ Socle tenable                      S2-S4      ████
C ─ Fiabilité sur périmètre réduit     S3-S7        ██████
D ─ Demande, autorité, conversion      S5-S14         ████████████
E ─ Transactionnel                     S15+                        ████
```

Chaque phase a une **porte de sortie mesurable**. On ne passe pas la porte, on
ne passe pas à la suite — mais les phases se chevauchent volontairement : A et B
sont du travail de plateforme, C et D du travail de produit, ils n'écrivent pas
dans les mêmes fichiers et peuvent avancer en parallèle (c'est la règle des
zones d'écriture disjointes, déjà éprouvée en juillet).

---

## Phase A — Vérité et réduction de surface

**Durée** : 2 semaines · **Thèse** : on ne peut pas piloter ce qu'on ne peut
pas voir, et on ne peut pas voir à travers 241 documents dont on ignore
lesquels sont vivants.

### A0 — Les 6 arbitrages PO à rendre avant tout code

Aucun lot ne démarre avant. Ces six questions sont celles qui ont refui dans
chaque sprint depuis mai ; elles se tranchent une fois, par écrit, dans un ADR.

| #        | Question                                                                                                                  | Recommandation                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A0-1** | **Le produit est-il un média-avec-mise-en-relation, ou une OTA ?**                                                        | **Média + mise en relation** jusqu'à la Phase E. Toute la communication et l'UI s'alignent dessus (fin des CTA « Réserver » morts)                      |
| **A0-2** | **Abandonne-t-on la complétude horizontale sur les 2 221 fiches ?**                                                       | **Oui.** On passe à un investissement ciblé (~150 fiches, ~50 classements). Le reste est figé en l'état                                                 |
| **A0-3** | **Outreach humain : on s'engage ou on renonce ?**                                                                         | **On s'engage** — 3 h/semaine, cadence tenue, sinon le projet n'a pas de moteur de croissance. Si non : basculer le budget sur du SEA borné             |
| **A0-4** | **Template fiche : `kit` ou standard ?** (décision D2 du 2 juillet, jamais rendue)                                        | **Trancher sur le comparatif existant, sous 5 jours.** Deux templates concurrents = deux fois le coût de chaque évolution. Un seul survit               |
| **A0-5** | **Verticales : on garde lesquelles ?** (hôtels, classements, guides, lieux, itinéraires, marques, labels, annuaire, club) | **Garder** hôtels · classements · guides · club. **Geler** lieux · itinéraires · marques · labels · annuaire (en place, noindex, plus d'investissement) |
| **A0-6** | **Locales : FR+EN suffisent-elles jusqu'en 2027 ?**                                                                       | **Oui.** V2 (es/de/it) et V3 restent fermées tant que l'EN n'a pas prouvé sa conversion                                                                 |

**Livrable** : `docs/adr/0032-recadrage-perimetre-aout-2026.md`, un ADR unique
qui grave les six réponses. Il _amende_ le `PROJET-MASTER-PLAN.md` du 17 juin
(pari « complétude horizontale ») — c'est le seul endroit où cette contradiction
est traitée, elle ne doit pas rester implicite.

### Lots

| Lot    | Travail                                                                                                                                                                                                                                     | Sortie                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **A1** | **ADR de recadrage** : graver A0-1 → A0-6                                                                                                                                                                                                   | `docs/adr/0032-*.md`                        |
| **A2** | **Un seul chiffre de catalogue.** Aujourd'hui le site affiche 2 219 / 2 929 / 2 984 selon la page (`AGENTS.md`, `llms.txt`, la home). Source unique en base, consommée partout, test de non-régression                                      | `lib/catalogue-stats.ts` + test             |
| **A3** | **Purge des artefacts.** `DA/` (15 Mo, quasi-doublon de `design/html-kit/`), `design/_compare/` (8,6 Mo de captures), `design/stitch/` (13 Mo) sortent de Git — soit supprimés, soit déplacés hors dépôt. **~36 Mo retirés**                | Dépôt allégé, `.gitignore` mis à jour       |
| **A4** | **Archivage documentaire.** Les 46 audits datés et les runbooks superseded passent sous `docs/_archive/` avec un bandeau « archive — ne pas exécuter ». Ne restent vivants que le cadrage, les ADR, les docs 01→10 et les runbooks courants | `docs/` réduit à l'utile, sans rien perdre  |
| **A5** | **Préséance des plans.** Bandeau explicite en tête des 3 plans maîtres antérieurs pointant vers ce dossier                                                                                                                                  | Zéro ambiguïté pour un agent frais          |
| **A6** | **Réduction du contexte agent.** `AGENTS.md` : 1 139 lignes → ~250 (règles dures + table d'aiguillage, l'historique part en archive). Les 30 règles `.mdc` et 48 skills sont audités : fusion des doublons, suppression des obsolètes       | Coût de démarrage de session divisé par 3-4 |
| **A7** | **Instrumentation zéro.** Brancher `@mch/observability` (pino, jamais importé aujourd'hui) sur les chemins serveur chauds ; poser la mesure de la demande concierge (aujourd'hui : _aucune_)                                                | On sait enfin combien de demandes arrivent  |

### Porte de sortie A

- L'ADR 0032 est mergé et les six arbitrages sont écrits.
- Le dépôt pèse ~36 Mo de moins ; `docs/` a une frontière nette vivant/archive.
- `AGENTS.md` tient en une lecture de 5 minutes.
- Un compteur de demandes concierge existe et affiche une valeur, même nulle.
- **Un agent frais qui ouvre le dépôt sait quoi faire en moins de 10 minutes.**
  C'est le vrai test de la Phase A ; il se vérifie en le faisant.

---

## Phase B — Socle tenable

**Durée** : 3 semaines (démarre en S2, en parallèle de la fin de A) ·
**Thèse** : le socle n'a pas besoin d'être refondu — il a besoin d'être
**fini**, sécurisé et débarrassé de ses doublons.

Cette phase est courte **parce qu'ADR-0031 a déjà réglé le plus gros** (Data
Cache, gains mesurés en dizaines de fois). Ce qui reste est du travail
d'achèvement, pas d'architecture.

### Lots

| Lot    | Travail                                                                                                                                                                                                                                                                                                 | Pourquoi maintenant                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **B1** | **Un seul template de fiche.** Application de l'arbitrage A0-4 : le perdant est supprimé, pas gardé « au cas où ». Concerne `components/hotel/kit/*` + `server/hotels/kit/*` (30+ fichiers) ou leur pendant legacy                                                                                      | Deux templates = double coût sur chaque évolution, pour toujours               |
| **B2** | **Sécuriser l'injection HTML.** `dangerouslySetInnerHTML` sur du HTML issu de la base (`hotel-page-kit.tsx`) viole la hard rule n°2 d'`AGENTS.md`. Sanitisation ou rendu par composants                                                                                                                 | Une faille XSS stockée sur la surface publique                                 |
| **B3** | **Rate limit fail-closed.** Redis indisponible → aujourd'hui `/api/agent/*` passe **sans aucune limite**. Doit renvoyer 429/503                                                                                                                                                                         | Une panne Redis expose 26 endpoints publics sans plafond                       |
| **B4** | **Un seul prédicat d'indexabilité.** Le prédicat est dupliqué en SQL (`0078_*.sql`) et en TypeScript (`indexability.ts`) — la divergence produit des sitemaps qui listent des pages `noindex`                                                                                                           | Signal contradictoire envoyé à Google, la pire catégorie de bug SEO            |
| **B5** | **Fin des pipelines non conformes.** 6 générateurs tournent encore sans grounding DataForSEO ni `hasLeak()` (`premium-section-generator`, `generate-guide` v1, `generate-ranking` v1, `description-extend`, `humanizer-faq`, `meta-desc-generator`). Supprimés ou marqués « deprecated, ne pas lancer » | Ils peuvent réintroduire du scaffolding dans un corpus qu'on vient de nettoyer |
| **B6** | **Élagage des scripts.** 374 scripts éditoriaux → classement en trois piles : _outillage vivant_ (garde), _one-shot historique_ (archive), _doublon v1/v2_ (supprime). Cible ≈ 150                                                                                                                      | Chaque script mort est un piège pour un agent futur                            |
| **B7** | **Charge utile de `/hotels`.** 10,4 Mo de HTML, 2 740 liens, aucune pagination. Pagination ou éclatement par pays                                                                                                                                                                                       | Gaspillage de budget de crawl et page inutilisable en mobile                   |
| **B8** | **Nettoyage des routes.** `/dev/*` fermées en production ; 8 guides pays codés en dur cohabitant avec la route dynamique `guide/[citySlug]` — unifier                                                                                                                                                   | Surface publique non intentionnelle                                            |

### Porte de sortie B

- Un seul template de fiche dans le dépôt, l'autre supprimé.
- `grep dangerouslySetInnerHTML` ne renvoie plus que `JsonLdScript`.
- Test rouge→vert prouvant le 429 quand Redis tombe.
- Le prédicat d'indexabilité a une source unique, avec un test de
  non-divergence.
- `/hotels` sous 500 Ko.
- Le nombre de scripts a baissé d'au moins 40 %, et chaque script restant a une
  ligne de description dans un index.

---

## Phase C — Fiabilité sur périmètre réduit

**Durée** : 4-5 semaines (démarre en S3) · **Thèse** : **un contenu faux coûte
plus cher qu'un contenu absent.** On répare ce qui est déjà indexé avant
d'espérer être indexé davantage.

Le périmètre est **le périmètre retenu en A0-5**, et rien d'autre : fiches
hôtels, classements, guides, club. Les verticales gelées ne sont pas corrigées,
elles sont mises en `noindex` et laissées telles quelles.

### Lots

| Lot    | Travail                                                                                                                                                                                                                                                                             | Volume                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **C1** | **Claims faux, priorité absolue.** Alignement sur la liste officielle Atout France (juin 2026) : `/en/categorie/palaces-paris` cite Ritz et Park Hyatt comme Palaces, annonce « twelve Palaces » et « reviewed every five years ». Tout est faux. Chaque claim est sourcé ou retiré | ~30 entités identifiées      |
| **C2** | **Mentions légales.** Des placeholders `[À COMPLÉTER]` sont liés depuis le pied de page de **toutes** les pages. Compléter (raison sociale, SIREN, hébergeur, médiateur tourisme) ou retirer le lien                                                                                | 1 page, risque juridique     |
| **C3** | **Purge du français dans l'anglais.** `/en/classements/lieu/paris` affiche du FR brut, « 8-star hotels », des dates 2023. L'EN génère déjà plus d'impressions que le FR — c'est la locale qu'on sabote                                                                              | échantillon + passe complète |
| **C4** | **Chaînes en dur.** 5 fichiers de pages classements rendent du FR codé en dur sur les pages EN, plus `global-error.tsx` monolingue                                                                                                                                                  | 5 fichiers                   |
| **C5** | **Compteurs et contradictions internes.** « Paris annoncé à 114 / 68 / 45 adresses selon la page », FAQ annonçant « 1 restaurant » face à 6 listés. Découle de A2                                                                                                                   | catalogue                    |
| **C6** | **Titres dupliqués.** Le template ajoute « à MyConciergeHotel » même quand la marque est déjà dans le titre → « Lieux à visiter \| MyConciergeHotel à MyConciergeHotel »                                                                                                            | `packages/seo/metadata.ts`   |
| **C7** | **Promesses de réservation dans le contenu indexé.** « Amadeus net rates, no commission intermediary » alors que la Phase 6 est gelée. Incohérent avec A0-1                                                                                                                         | contenu                      |
| **C8** | **Crawl-focus assumé.** Application de la décision D3 : `noindex` + retrait des sitemaps pour les destinations de moins de 3 hôtels, les verticales gelées, les sous-pages de chambres. Réversible                                                                                  | ~5 000 URLs                  |

### Porte de sortie C

- Zéro claim non sourcé sur le périmètre retenu, vérifié par re-audit.
- Marche complète FR + EN, desktop + mobile, sur 20 pages de tête : aucun texte
  de la mauvaise langue, aucun compteur contradictoire, aucune promesse de
  réservation.
- Mentions légales conformes ou lien retiré.
- Surface indexable réduite d'au moins 50 %, et **le ratio pages-avec-impressions
  monte mécaniquement** — c'est la mesure qui valide la porte.

---

## Phase D — Demande, autorité, conversion

**Durée** : 8-10 semaines, démarre en S5, en continu · **Thèse** : c'est la
seule phase qui crée de la valeur. Tout ce qui précède existe pour la rendre
possible.

### D.1 — Conversion (en premier, c'est le plus court chemin vers un euro)

| Lot    | Travail                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **CTA universel « Demander au Concierge ».** Zéro bouton désactivé sur tout le catalogue. C'est la traduction UI de l'arbitrage A0-1                                                     |
| **D2** | **Le funnel de demande, de bout en bout** : formulaire → e-mail opérateur → accusé de réception client → suivi. Les templates existent (`packages/emails`), le parcours doit être prouvé |
| **D3** | **Mesure du funnel** : vue fiche → clic CTA → formulaire soumis → demande qualifiée. Sans PII dans les logs (hard rule n°3)                                                              |
| **D4** | **Le Concierge Club** comme mécanique de capture d'e-mails, pas comme produit payant                                                                                                     |

### D.2 — Autorité (le goulot n°1, et il ne s'automatise pas)

| Lot    | Travail                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D5** | **Cadence d'outreach tenue** (conditionnée à A0-3) : le pack presse, les 200 cibles et les modèles d'e-mails FR/EN existent déjà dans `docs/marketing/`. Il manque uniquement l'envoi |
| **D6** | **Leviers d'autorité 100 % agent** : page badge partenaire auto-servie (déjà livrée), données citables, maillage interne, orphelins. C'est le seul « PageRank » qu'on contrôle        |
| **D7** | **Opérations GSC** : resoumission des sitemaps après la coupe C8, suivi hebdomadaire de la couverture                                                                                 |

### D.3 — Demande qualifiée

| Lot     | Travail                                                                                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D8**  | **Matrice lexicale.** 521 slugs `meilleurs-*` contre ~1 `hotel-de-luxe-*`, alors que le volume est sur « hôtel de luxe {ville} » / « luxury hotels {city} » — 10 à 30 fois supérieur. **Seule création de contenu autorisée** |
| **D9**  | **Investissement ciblé** : les ~150 fiches et ~50 classements du périmètre retenu montés au niveau de référence (photos comprises — c'est ici que la Phase 2 photos revient, ciblée et non en volume)                         |
| **D10** | **Optimisation GEO/AEO** : le canal où l'autorité classique compte le moins et où le projet est déjà en avance                                                                                                                |

### Porte de sortie D — c'est la porte qui décide de la suite du projet

| Mesure                               | Seuil de passage        |
| ------------------------------------ | ----------------------- |
| Demandes concierge qualifiées / mois | **≥ 20**                |
| Pages avec impressions GSC           | **≥ 15 %** des soumises |
| Mots-clés classés FR                 | **≥ 50**                |
| Domaines référents                   | **≥ 15**                |
| CTA morts                            | **0**                   |

**Si la porte ne s'ouvre pas au bout de 10 semaines, on ne passe pas en Phase E
— on refait un choix de canal.** Dégeler le booking sur un site que personne ne
visite ne produirait rien d'autre que du travail.

---

## Phase E — Transactionnel

**Durée** : à cadrer à l'ouverture · **Condition d'entrée** : la porte D est
franchie. C'est la « dernière brique » d'`AGENTS.md` §4ter, et la ligne
d'arrivée L2 du plan maître de juin.

**Ce que la Phase E n'est pas** : un dégel général. C'est un **pilote borné**,
tel que déjà cadré par la décision D1b du 2 juillet : 50 à 100 hôtels, un seul
connecteur, un parcours mesuré de bout en bout.

| Lot    | Travail                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1** | **Choix du connecteur unique** parmi ceux déjà intégrés (Travelport, Amadeus, RateHawk, Little Hotelier). Les autres restent gelés, pas supprimés |
| **E2** | **Pilote sur 50-100 hôtels** — inventaire réel, prix réels, disponibilité réelle                                                                  |
| **E3** | **Tunnel** : idempotence, machine à états, politiques d'annulation verbatim (`docs/05-booking-flow.md` est déjà écrit)                            |
| **E4** | **Paiement** via Amadeus Payments (PCI hors périmètre)                                                                                            |
| **E5** | **Réactivation du JSON-LD `Offer`** avec `priceValidUntil`, et **uniquement** sur le périmètre réellement réservable                              |
| **E6** | **Fidélité facturable** (`LOYALTY_PREMIUM_BILLING_ENABLED`, ADR-0005)                                                                             |

**Garde-fou permanent** : aucune promesse de prix ou de disponibilité sur une
page qui n'est pas réellement réservable. C'est la règle qui a été violée en
juillet (contenu annonçant des « net rates » avec la phase gelée) et qui doit
tenir cette fois.

---

## 5. Calendrier

```
S1  ████ A0 arbitrages · A1-A2
S2  ████ A3-A7 purge & instrumentation    │ B1-B3 démarrage
S3  ████ B4-B8                            │ C1-C2 claims & légal
S4  ████ B fin · porte B                  │ C3-C5 parité EN
S5  ████ C6-C8 · porte C                  │ D1-D3 conversion    │ D5 outreach ▶ continu
S6  ████ D1-D4 funnel prouvé              │ D6-D7 autorité agent
S7-S8  ██ D8 matrice lexicale             │ D9 investissement ciblé
S9-S12 ██ D9 suite · D10 GEO              │ D5 outreach continu
S13 ████ Re-mesure complète · PORTE D
S14 ████ Go / no-go Phase E
```

**Deux flux permanents, jamais dans les mêmes fichiers** : _plateforme_
(A → B) et _produit / contenu_ (C → D). C'est ce qui permet à deux agents
Cursor de travailler en simultané sans conflit — la mécanique éprouvée en
juillet et documentée dans `04-briefs-cursor.md`.

---

## 6. Ce que ce plan refuse explicitement

Écrit ici pour qu'on n'ait pas à en rediscuter :

- **Pas de refonte design.** Un seul template est choisi (A0-4), point.
- **Pas de nouvelles locales** avant la porte D.
- **Pas d'application mobile.** Le skill `mobile-app-expo` part en archive.
- **Pas de contenu net nouveau** hors matrice lexicale D8.
- **Pas de retour au cache HTML / ISR** : ADR-0031 a tranché sur preuve
  mesurée. Rouvrir demande un ADR et une revue de sécurité, pas une intuition.
- **Pas de dégel du booking** avant la porte D.
- **Pas de nouveau vendor** ni de nouvelle intégration en Phases A→D.
- **Pas de photos en volume** : uniquement les ~150 fiches ciblées de D9.
