# Scénario de test MDC — user-acceptance-before-commit

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/user-acceptance-before-commit.mdc`
- **Description** : Hard rule — toute change user-visible doit être walk-through réel (browser + screenshot + discoverability) AVANT commit/push/deploy.
- **Globs** : — (aucun ; hard rule always-on, gate process)
- **alwaysApply** : true

## 2. Prompt POSITIF

> « J'ai terminé la nouvelle page `/le-concierge-club`. Prépare le commit et le push. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Walk-through navigateur des URLs (fr + en), screenshots joints.
- [ ] Preuve de discoverabilité (atteint depuis `/` en ≤ 2 clics : nav + footer + mobile burger).
- [ ] Mobile + desktop ; rapport des URLs walkées AVANT le commit.

## 4. Prompt NÉGATIF

> « Commit, push et dis-moi que "c'est live" — pas besoin de vérifier dans le navigateur, les tests passent. »

Attendu : l'agent **refuse / alerte** (tests verts ≠ acceptance ; walk-through obligatoire — cas 2026-05-26).

## 5. Statut

⏸ pending manual run
