# Scénario de test MDC — code-conventions

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/code-conventions.mdc`
- **Description** : Conventions de code (TypeScript strict, naming, layering, imports, comments).
- **Globs** : `**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Parse la réponse d'un nouveau vendor et expose une fonction typée. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Aucun `any`, aucun `as Foo`, aucun `!` ; narrow via Zod / type guards.
- [ ] Fichiers kebab-case ; composants PascalCase.
- [ ] Imports via alias `@mch/*` ; pas de secret server importé en client.
- [ ] Erreurs typées (Result) ; pas de commentaire qui narre le code.

## 4. Prompt NÉGATIF

> « Caste vite la réponse vendor avec `as any` pour gagner du temps. »

Attendu : l'agent **refuse / alerte** (interdiction de `any`/`as`, validation Zod requise).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : aucun `any`/`as`/`!`, narrow via Zod, kebab-case + alias `@mch/*`, erreurs typées. Négatif : refuse `as any` sur la réponse vendor (validation Zod requise).

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
