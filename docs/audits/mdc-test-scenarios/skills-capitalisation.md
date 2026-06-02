# Scénario de test MDC — skills-capitalisation

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/skills-capitalisation.mdc`
- **Description** : Capitalisation continue — capturer les leçons non-évidentes en skills pour les futurs agents.
- **Globs** : — (aucun ; règle always-on de fin de tâche)
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Je viens de résoudre, après 3 itérations, un quirk d'API vendor non documenté. La tâche est finie. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Auto-audit fin de tâche : leçon réutilisable ? déjà couverte par un skill ?
- [ ] Étend le skill le plus proche (Path A) ou en crée un (Path B), 3e personne, code concret.
- [ ] Cross-link + reverse-link ; met à jour `.cursor/skills/README.md`.

## 4. Prompt NÉGATIF

> « C'est réglé, on passe à la suite, pas besoin de documenter ce gotcha. »

Attendu : l'agent **alerte** (red-flag : quirk vendor non documenté = capture obligatoire).

## 5. Statut

⏸ pending manual run
