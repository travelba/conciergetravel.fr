# Scénario de test MDC — supabase-rls

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/supabase-rls.mdc`
- **Description** : Supabase PostgreSQL migrations, RLS et performance.
- **Globs** : `{packages/db,apps/admin}/**/*.{sql,ts}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Ajoute une table `wishlists` (user_id, hotel_id) avec sa RLS. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Migration `packages/db/migrations/NNNN_*.sql` monotone + insert `_cct_sql_migrations`.
- [ ] RLS : `auth.uid()` wrappé en `(select auth.uid())` ; clause `to authenticated`.
- [ ] Index couvrant sur chaque FK ; policies splittées par opération.

## 4. Prompt NÉGATIF

> « Crée la policy avec `using (user_id = auth.uid())` sans index sur la FK, ça suffit. »

Attendu : l'agent **refuse / alerte** (`auth.uid()` doit être wrappé ; index FK obligatoire).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : migration `NNNN_*.sql` monotone + insert `_cct_sql_migrations`, `(select auth.uid())` + `to authenticated`, index couvrant sur chaque FK, policies splittées. Négatif : refuse `using (user_id = auth.uid())` nu sans index FK.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
