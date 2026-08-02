# Gouvernance et KPI — les règles du jeu

> Ce qui a manqué au projet n'est ni la vélocité ni la qualité : c'est un cap
> tenu et une mesure honnête. Ce document existe pour que le recadrage ne
> devienne pas le huitième plan empilé sur les sept précédents.

---

## 1. Pourquoi les plans précédents n'ont pas tenu

Trois modes d'échec, tous documentés dans le dépôt, tous adressés ici.

**Les décisions non tranchées refuient dans chaque sprint.** La décision D2 du
2 juillet — « template kit ou standard, on tranche sur preuve en semaine 2 » —
n'a jamais été rendue. Un mois plus tard, les deux templates coexistent encore
et chaque évolution de fiche coûte double.
→ _Parade_ : les six arbitrages A0 sont un **prérequis bloquant**. Aucun lot ne
démarre sans eux, et ils sont gravés dans un ADR, pas dans un fil de discussion.

**Reporter un goulot ne le fait pas disparaître.** La décision D4 a reporté
l'outreach humain en compensant par des « leviers 100 % agent ». Le plan
lui-même annonçait la conséquence : « le goulot n°1 ne bougera presque pas à
M+1 ». Il n'a pas bougé.
→ _Parade_ : l'arbitrage A0-3 exige un engagement chiffré ou un renoncement
explicite. Pas de troisième voie.

**On a mesuré la production, pas le résultat.** La matrice de progression
pondérée d'`AGENTS.md` §4ter affichait « hors-booking ≈ 68 % » pendant que le
site avait 1 mot-clé classé et 0 € de revenu. C'est un indicateur d'effort
déguisé en indicateur d'avancement.
→ _Parade_ : elle est retirée. Les KPI ci-dessous mesurent tous un effet
extérieur — impressions, positions, demandes reçues — jamais un pourcentage de
tâches accomplies.

---

## 2. Cadence

**Rituel hebdomadaire, 30 minutes, non négociable.** Une seule réunion avec
soi-même, toujours dans cet ordre :

1. **Mesurer** — le tableau de KPI de la section 3, rempli avant toute
   discussion. Un KPI non mesuré s'écrit « non mesuré », jamais estimé.
2. **Regarder les portes** — la porte de phase en cours est-elle franchie ?
3. **Décider une chose** — un seul arbitrage par semaine, écrit.
4. **Lancer les lots de la semaine** — au maximum deux lanes en parallèle.

**Cadence des lots.** Un lot = une branche = une PR = une porte d'acceptation.
Un lot qui dépasse 5 jours est un lot mal découpé : on le coupe, on ne le
prolonge pas.

**Parallélisme.** Deux lanes au maximum (plateforme et contenu), zones
d'écriture disjointes. Le pic à 5-6 agents de juillet a produit des
chevauchements et du temps de merge — on ne recommence pas.

---

## 3. Les KPI — dix chiffres, pas un de plus

Relevés chaque lundi. La colonne « source » est obligatoire : un KPI sans source
est une impression.

| #   | KPI                                        | Baseline (02/07/2026) | Cible porte C | Cible porte D | Source                             |
| --- | ------------------------------------------ | --------------------- | ------------- | ------------- | ---------------------------------- |
| 1   | **Demandes concierge qualifiées / mois**   | **non mesuré**        | mesuré        | **≥ 20**      | compteur du lot A7                 |
| 2   | Pages avec impressions GSC                 | 191 / 8 202 (2,3 %)   | ≥ 8 %         | **≥ 15 %**    | Search Console, 28 j               |
| 3   | Mots-clés classés FR                       | 1                     | ≥ 10          | **≥ 50**      | DataForSEO Labs                    |
| 4   | Panier de 12 requêtes cibles en top 20     | 0 / 12                | 1 / 12        | **4 / 12**    | DataForSEO SERP live               |
| 5   | Domaines référents                         | ~0                    | ≥ 3           | **≥ 15**      | DataForSEO Backlinks               |
| 6   | CTA de réservation morts                   | majorité du catalogue | —             | **0**         | comptage automatisé                |
| 7   | Claims non sourcés sur le périmètre retenu | > 0                   | **0**         | 0             | re-audit de contenu                |
| 8   | Pages EN avec du FR résiduel               | > 0                   | **0**         | 0             | audit i18n                         |
| 9   | TTFB fiche hôtel (à chaud)                 | 1 300 ms              | < 1 000 ms    | < 800 ms      | `curl.exe -w` en production        |
| 10  | Scripts sans description dans le README    | 374                   | **0**         | 0             | index de `scripts/editorial-pilot` |

**Le KPI n°1 est le KPI n°1.** Le trafic est un moyen ; la demande captée est la
fin. Un mois avec 25 demandes et un trafic stagnant est un bon mois. L'inverse
n'en est pas un.

**Ce qu'on ne mesure plus** : le pourcentage de complétion de phase, le nombre
de fiches « au niveau Gordes », le nombre de commits, le nombre de pages
publiées. Ces chiffres ont monté pendant un an sans que le résultat bouge.

---

## 4. Les portes de phase

Une porte se franchit ou ne se franchit pas. Elle ne se franchit pas « à peu
près ».

| Porte | Condition                                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | ADR 0032 mergé (6 arbitrages) · dépôt allégé de ~36 Mo · `AGENTS.md` ≤ 250 lignes · compteur de demandes concierge en service, même à zéro                                          |
| **B** | Un seul template de fiche · zéro `dangerouslySetInnerHTML` hors `JsonLdScript` · rate limit fail-closed testé · prédicat d'indexabilité unique · `/hotels` < 500 Ko · scripts −40 % |
| **C** | KPI 7 = 0 · KPI 8 = 0 · mentions légales conformes ou lien retiré · surface indexable réduite de ≥ 50 % · marche complète de 20 pages FR+EN                                         |
| **D** | KPI 1 ≥ 20 · KPI 2 ≥ 15 % · KPI 3 ≥ 50 · KPI 5 ≥ 15 · KPI 6 = 0                                                                                                                     |
| **E** | Porte D franchie **et** décision explicite d'ouvrir le pilote transactionnel                                                                                                        |

**Si la porte D ne s'ouvre pas au bout de 10 semaines**, on ne prolonge pas : on
refait un choix de canal. Brancher une réservation sur un site que personne ne
visite ne produit que du travail.

---

## 5. Definition of Done — un lot est fini quand

1. Le code passe `pnpm lint`, `pnpm typecheck` et `pnpm test`.
2. Les tests couvrent le comportement ajouté — et pour une correction de bug,
   un test qui échouait **avant** la correction.
3. **La marche d'acceptation utilisateur est faite et rapportée** : URLs
   parcourues, chemin de découverte, FR **et** EN, mobile **et** desktop. La
   règle vient d'un cas réel — le Concierge Club a été livré avec cinq pages et
   zéro entrée de navigation, et le PO a atterri sur la home sans rien trouver.
4. Le KPI que le lot est censé bouger a été mesuré avant et après.
5. La documentation touchée est à jour dans le même commit.
6. Rien n'a été écrit hors de la zone d'écriture déclarée.

---

## 6. Conditions d'arrêt — l'agent s'arrête et remonte

- Une **décision de gouvernance** apparaît : périmètre, suppression de données,
  dégel du booking, indexabilité. L'agent ne tranche jamais.
- **`hasLeak()` s'emballe** sur un lot de contenu — signe d'une régression de
  scaffolding.
- Une **erreur d'API répétée** sur un vendor.
- Un **KPI chute brutalement** après un merge. Suspects par ordre de
  probabilité : le lot de crawl-focus, puis le lot de performance.
- Le lot **dépasse 5 jours**. On coupe, on ne prolonge pas.
- Une suppression toucherait des **données publiées**. Jamais sans validation PO
  explicite.

---

## 7. Ce qui est fermé — ne pas rouvrir sans ADR

| Question                              | Statut                        | Référence                                           |
| ------------------------------------- | ----------------------------- | --------------------------------------------------- |
| Cache HTML / ISR / `force-static`     | **Fermée sur preuve**         | ADR-0031 — mesuré : 58 violations CSP, 0 JS exécuté |
| Modèle CSP (nonce, `strict-dynamic`)  | **Fermée**                    | ADR-0027, β-gate sécurité requis                    |
| URL des fiches `/hotel/<slug>` à plat | **Fermée**                    | ADR-0008                                            |
| Sous-pages de chambres indexables     | Réouverte par le crawl-focus  | ADR-0009 amendé par le lot C8                       |
| PREMIUM facturable                    | **Différée en Phase E**       | ADR-0005                                            |
| Locales au-delà de FR/EN              | **Fermée jusqu'à la porte D** | arbitrage A0-6                                      |
| Application mobile                    | **Fermée**                    | arbitrage — skill supprimé                          |
| Comparateur de prix                   | **Fermée**                    | hors périmètre retenu                               |
| Booking                               | **Gelée jusqu'à la porte D**  | `AGENTS.md` §4ter + arbitrage A0-1                  |

Rouvrir une de ces questions demande un ADR argumenté par des faits nouveaux —
c'est exactement ce qu'a fait ADR-0031 pour le cache, et c'est le bon modèle.

---

## 8. Capitalisation

Toute difficulté rencontrée **deux fois** devient une règle ou un skill. Sinon
on repaie la leçon à chaque session. Deux exemples récents, déjà capitalisés et
qui valent d'être connus :

- **Un échec d'écriture dans le Data Cache est silencieux.** Au-delà de 2 Mo,
  l'entrée n'est pas écrite, la fonction renvoie quand même son résultat, et le
  seul signal est une ligne de log serveur. Toute mise en cache d'une charge à
  l'échelle du catalogue se vérifie par une mesure de TTFB à chaud, jamais par
  déduction.
- **Une lenteur peut être CPU et non I/O.** `/destination/paris` tenait 21 s
  avec le cache chaud : une carte d'auto-liens de 5 000 entrées était recompilée
  en expressions régulières à chaque rendu de composant. Profiler avant
  d'optimiser une requête.

---

## 9. Le rapport hebdomadaire — le format

Un fichier par semaine sous `docs/runbooks/`, jamais plus d'une page :

```markdown
# Semaine {ISO} — {dates}

## KPI

{le tableau des 10 lignes, colonne « cette semaine » remplie}

## Lots terminés

{lot, branche, KPI visé, KPI constaté}

## Lots en cours

{lot, lane, jour n/5}

## La décision de la semaine

{une seule, écrite}

## Ce qui bloque

{ou « rien »}
```

Si trois semaines de suite affichent « rien ne bloque » alors que les KPI ne
bougent pas, c'est le rapport qui ment, pas les KPI.
