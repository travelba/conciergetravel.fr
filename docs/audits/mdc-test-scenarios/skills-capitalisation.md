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

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : auto-audit fin de tâche (leçon réutilisable ? déjà couverte ?), étend le skill le plus proche (3e personne, code concret), cross-link + README. Négatif : alerte sur « pas besoin de documenter » (red-flag : quirk vendor non documenté = capture obligatoire).

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
