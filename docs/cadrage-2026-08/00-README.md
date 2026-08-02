# Recadrage A → E — MyConciergeHotel.com (août 2026)

> **À quoi sert ce dossier.** Reprendre le projet comme si on repartait de zéro,
> mais en héritant de tout ce qui a déjà été pensé, écrit et construit. Le
> résultat est un **plan complet, exécutable par Cursor**, dans lequel chaque
> élément existant est explicitement classé : **on garde, on refond, on
> supprime**.

**Date** : 2026-08-02
**Auteur** : session de recadrage (lecture complète du dépôt + des plans
antérieurs)
**Statut** : proposition de cadrage — la Phase A commence par les arbitrages PO
listés en [`01-cadrage-A-E.md` §A0](01-cadrage-A-E.md#a0--les-6-arbitrages-po-à-rendre-avant-tout-code).

---

## Le dossier en 5 fichiers

| Fichier                                                                  | Ce qu'il contient                                                                                                                 | Pour qui                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [`01-cadrage-A-E.md`](01-cadrage-A-E.md)                                 | **Le plan maître.** Diagnostic, thèse, les 5 phases A→E, leurs lots, leurs portes de sortie, le calendrier                        | PO — à lire en entier, une fois |
| [`02-inventaire-garder-supprimer.md`](02-inventaire-garder-supprimer.md) | **L'inventaire de l'existant**, fichier par fichier / dossier par dossier : GARDER · REFONDRE · GELER · SUPPRIMER                 | PO (validation) puis Cursor     |
| [`03-architecture-cible.md`](03-architecture-cible.md)                   | La forme du dépôt et du produit **après** le recadrage : arborescence cible, surface de routes retenue, contrats techniques       | Cursor (référence permanente)   |
| [`04-briefs-cursor.md`](04-briefs-cursor.md)                             | **Les prompts prêts à coller** dans Cursor, un par lot, avec zone d'écriture, critères d'acceptation et commandes de vérification | Cursor (exécution)              |
| [`05-gouvernance-et-kpi.md`](05-gouvernance-et-kpi.md)                   | Règles du jeu : cadence, definition of done, KPI hebdomadaires, conditions d'arrêt, ce qu'on n'a pas le droit de rouvrir          | PO + Cursor (rituel hebdo)      |

---

## Comment ce recadrage a été produit

Rien n'a été inventé. Le cadrage part de six sources déjà présentes dans le
dépôt, relues intégralement :

1. `AGENTS.md` (1 139 lignes) — les règles dures, la décision « contenu écrit
   d'abord, photos en dernier » (§4bis) et « le booking est la dernière brique »
   (§4ter, avec sa matrice de progression pondérée).
2. `docs/runbooks/PROJET-MASTER-PLAN.md` (17 juin) — la vision, les décisions
   stratégiques verrouillées, la ligne d'arrivée L1 (éditorial + GEO + leads)
   distincte de L2 (transactionnel).
3. `docs/audits/audit-complet-projet-2026-07-02.md` — l'audit 4 volets
   (parcours prod, front, back, SEO/GEO) et son backlog priorisé.
4. `docs/runbooks/master-plan-multi-agent-2026-07.md` — les décisions PO D1→D5
   du 2 juillet et la cartographie en 9 workstreams à zones d'écriture
   disjointes.
5. `docs/adr/` (33 ADR) — en particulier ADR-0027 et **ADR-0031**, qui ont
   tranché la question du cache HTML sur preuve mesurée.
6. Le code lui-même : 67 routes de pages, 51 handlers d'API, 155 composants,
   374 scripts éditoriaux, 78 migrations, 65 fichiers de tests unitaires,
   29 specs E2E.

**Ce que le recadrage ajoute** par rapport à ces sources : il les **fusionne en
une seule ligne de conduite**, il **tranche les contradictions** entre elles, et
surtout il fait ce qu'aucune n'a fait — **décider ce qu'on supprime**. Les plans
antérieurs empilaient des chantiers ; celui-ci commence par retirer.

---

## Le recadrage en un paragraphe

Le projet possède un actif rare — 2 200+ hôtels documentés, une couche
structurée (JSON-LD, sitemaps, surface agent) supérieure au leader du marché —
et n'en tire aucun résultat : **1 mot-clé classé, 2,3 % des pages avec des
impressions, 0 € de revenu, un bouton « Réserver » désactivé sur l'essentiel du
catalogue.** L'écart ne vient pas d'un manque de production : il vient d'une
**surface trop large** (7 verticales éditoriales, 374 scripts, 48 skills,
30 règles, 2 templates de fiche concurrents, 241 documents) entretenue par une
seule personne assistée d'agents. Le recadrage consiste donc à **choisir un
produit** — un média éditorial de référence sur l'hôtellerie de luxe, monétisé
par la mise en relation concierge, dont la réservation est la dernière brique —
puis à **supprimer, geler ou archiver tout ce qui ne le sert pas dans les six
prochains mois**, avant de reprendre la construction.

---

## Comment s'en servir concrètement

1. **Le PO lit `01-cadrage-A-E.md`** et rend les six arbitrages de la
   section A0. Sans eux, rien ne démarre — c'est exactement le mode d'échec
   des plans précédents, où les décisions non tranchées ont refui dans chaque
   sprint.
2. **Le PO valide `02-inventaire-garder-supprimer.md`** en cochant les
   suppressions. C'est la seule étape irréversible du plan : elle passe par une
   branche dédiée et un commit unique, réversible par `git revert`.
3. **Cursor exécute lot par lot** en collant le brief correspondant de
   `04-briefs-cursor.md`. Un lot = une branche = une PR = une porte
   d'acceptation.
4. **Le rituel hebdomadaire de `05-gouvernance-et-kpi.md`** mesure. Un KPI qui
   ne bouge pas pendant deux semaines déclenche une re-décision, pas un
   redoublement d'effort.

> **Règle de préséance.** En cas de contradiction entre ce dossier et un
> document antérieur (`PROJET-MASTER-PLAN.md`, `master-plan-multi-agent-2026-07.md`,
> `plan-execution-post-audit-2026-07-02.md`), **ce dossier gagne** à partir du
> 2026-08-02. Les documents antérieurs restent lisibles comme archive de la
> réflexion, et sont marqués comme tels en Phase A (lot A5).
> Les seules exceptions sont les **ADR** et les **hard rules d'`AGENTS.md` §4**,
> qui gardent leur autorité : on ne les contourne pas, on les amende par un
> nouvel ADR.
