# Cahier des charges — site éditorial MyConciergeHotel v2

> **Objet** : spécification complète du nouveau site, conçue pour être
> **exécutée par des agents Cursor** avec un minimum d'arbitrage humain.
> **Objectif produit** : concurrent direct de **yonder.fr** sur le
> référencement — premier sur Google, cité par les LLM. **Aucune réservation.**
> **Statut** : en cours de rédaction. Le chapitre 03 fait référence pour le
> niveau de détail attendu.

---

## Comment ce CDC est fait

Chaque chapitre de gabarit est écrit pour qu'un agent puisse le construire sans
poser de question. Il contient donc toujours, dans cet ordre :

1. **Intention** — ce que la page doit gagner, et contre qui
2. **Anatomie** — les blocs, dans l'ordre, avec leurs règles
3. **Données** — les champs consommés, leur origine, le comportement si absent
4. **Balisage** — JSON-LD et métadonnées, exhaustifs
5. **Comportements** — responsive, états vides, erreurs, performance
6. **Critères d'acceptation** — vérifiables, binaires
7. **Lots de travail** — le découpage exécutable, avec les prompts à coller

Un agent qui doit deviner quelque chose signale le manque au lieu d'inventer.
Un CDC qui laisse deviner est un CDC incomplet — c'est un défaut à corriger
dans ce document, pas dans le code.

---

## Sommaire

| # | Chapitre | Statut |
| --- | --- | --- |
| **00** | [Vue d'ensemble](00-vue-densemble.md) — périmètre, actif repris, phases, mesure | ✅ écrit |
| **01** | Architecture technique — stack, rendu, arborescence, conventions | à écrire |
| **02** | Modèle de données — tables consommées, contrats de lecture | à écrire |
| **03** | [Gabarit **classement**](03-gabarit-classement.md) — la page reine | ✅ écrit |
| **04** | Gabarit **fiche hôtel** | à écrire |
| **05** | Gabarit **destination** et **annuaire** | à écrire |
| **06** | Gabarits **guide** et **lieu** | à écrire |
| **07** | Surface machine — `llms.txt`, API agent, feeds, stratégie GEO | à écrire |
| **08** | SEO technique — URL, lexique, sitemaps, hreflang, redirections | à écrire |
| **09** | Contenu éditorial — règles d'écriture, grounding, interdits | à écrire |
| **10** | Lots de travail Cursor — missions prêtes à déléguer | à écrire |

---

## Règles transverses — s'appliquent à tous les chapitres

Ces règles n'ont pas à être répétées dans chaque mission ; un agent doit les
tenir pour acquises.

### Interdits absolus

- **Aucun fait inventé.** Un nom d'architecte, un chef, une anecdote, un prix :
  sourcé ou retiré. Le site est signé par une agence de voyage immatriculée —
  une affirmation fausse sur un établissement réel est un risque juridique, pas
  une imprécision éditoriale.
- **Aucune promesse transactionnelle.** Pas de prix live, pas de disponibilité,
  pas de bouton de réservation, pas de nœud `Offer` en JSON-LD. Le périmètre
  est éditorial.
- **Aucun indicateur d'urgence fabriqué** (« 3 personnes consultent cette
  page »). Interdit par le DSA et la DGCCRF.
- **Aucune chaîne de texte en dur** dans les composants — tout passe par les
  fichiers de traduction.
- **Aucun `any`, `as`, `!`** en TypeScript.

### Obligations

- **Bilingue FR + EN** sur toute surface publique, avec `hreflang` réciproque.
- **Statique par défaut.** Une page qui ne peut pas être servie depuis le cache
  doit justifier pourquoi.
- **JSON-LD complet** sur chaque page, via les constructeurs de `@mch/seo`.
- **Marche utilisateur avant livraison** : la page est parcourue réellement, en
  FR et en EN, sur mobile et desktop, avec captures jointes.

### Ce qui fait référence

- **Le concurrent.** Chaque gabarit se compare à l'équivalent yonder.fr. Si la
  page neuve ne soutient pas la comparaison côte à côte, elle n'est pas finie.
- **La donnée.** Les chiffres du site viennent de la base, jamais d'une
  constante écrite à la main.

---

## Décisions ouvertes — à trancher avant les chapitres concernés

| # | Décision | Bloque le chapitre |
| --- | --- | --- |
| **1** | Lexique : `hotel-de-luxe-{ville}` pilier et `meilleurs-hotels-{ville}` alias, ou l'inverse | 08 |
| **2** | Annuaire : indexé, désindexé, ou indexé par seuil de qualité | 05 |
| **3** | Chantier autorité : démarre-t-il maintenant ? | aucun — mais conditionne le résultat de tout le reste |
