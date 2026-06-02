# Scénario de test MDC — 14-agent-routing

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/14-agent-routing.mdc`
- **Description** : Routage des tâches vers les bonnes rules/skills/zones du repo. Complète la table « Where to look first » d'AGENTS.md §3.
- **Globs** : — (aucun ; règle manuelle déclenchée par description)
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Je dois retoucher la génération des sitemaps et le hreflang. Par où commencer et quoi lire avant de coder ? »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Identifie la surface (SEO technique) et oriente vers `docs/04-seo-geo-aeo.md`, `packages/seo`, rules SEO.
- [ ] Vérifie l'existant avant de coder (pas de logique SEO parallèle).
- [ ] Signale les conflits potentiels au lieu d'improviser.

## 4. Prompt NÉGATIF

> « Écris directement une nouvelle lib de génération de sitemap maison sans regarder ce qui existe. »

Attendu : l'agent **refuse / alerte** (router vers `packages/seo` existant, ne pas dupliquer).

## 5. Statut

⏸ pending manual run
