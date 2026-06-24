# Handoff — Classements complets vs yonder.fr (reprise 2026-06-24 ~18:40)

Note de reprise après arrêt machine. Le plan complet :
`c:\Users\benja\.cursor\plans\classements_complets_vs_yonder_508f36c8.plan.md`.
Rapport d'audit chiffré : `docs/audits/rankings-completion-plan-2026-06-24.md`.

## État par phase

| Phase                           | Statut                                 | Détail                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — Audit & quantification**  | ✅ DONE, poussé (`2a5ec5a2`)           | 474 pages yonder crawlées → 2 132 hôtels. Gap : **867 `qualifie`** manquants (481 FR / 386 intl). 44 classements sous-remplis, 421 seeds livrables sans onboarding, 7 hôtels mal city-taggés.                                              |
| **B — Maillage interne**        | ✅ DONE, poussé + déployé prod         | 4 commits `e516f9db`→`039bd950` (cross-link thème/chaîne, CTA destination, marque/label→classements, mobile parity + cap auto-link). Résidu : walk visuel mobile (pas de Chrome sur la machine).                                           |
| **C — Fiabiliser la sélection** | ⏳ INTERROMPU (worker tué par l'arrêt) | C1 (luxury_tier + match ville durci) + C2 (gate complétude) **en cours, AUCUN commit** — à relancer depuis zéro. C3 (data-fix 7 villes) **pas commencé**.                                                                                  |
| **D — Onboarding 867 hôtels**   | ⏳ PARTIEL                             | D1 scaffold : outil `scaffold-missing-rest.ts` **commité**. Preview généré (disque) : **860 lignes prêtes**, 7 non-mappées. **Live insert (SQL via Supabase MCP) : statut À VÉRIFIER** — possiblement non exécuté. D2/D3/D4 non commencés. |
| **E — Regénération + re-audit** | ⏸️ NON COMMENCÉ                        | Gated sur C + D.                                                                                                                                                                                                                           |

## Artefacts sur disque (gitignorés, survivent à l'arrêt)

Dossier `scripts/editorial-pilot/yonder/` :

- `diff-missing.json` — entrée Phase D (867 `qualifie` triés).
- `audit-rankings.json` / `audit-city-falsepos.json` — matrice sélection + 7 faux positifs ville.
- `scaffold-rest-to-insert.json` — **860 lignes prêtes** (city/region/country_code/luxury_tier résolus).
- `scaffold-rest-hotels.sql` — INSERT chunké (`on conflict (slug) do nothing`), à exécuter via Supabase MCP `execute_sql` (rôle privilégié, le service-role JWT n'a pas BYPASSRLS → 42501 en PostgREST direct).
- `scaffold-rest-unmapped.json` — 7 hôtels non-mappés (pays/slug irrésolu).

## Reprise — ordre exact

1. **Vérifier l'état D1 en base** (l'insert a-t-il eu lieu ?) :
   ```sql
   select count(*) from public.hotels where priority='P2' and booking_mode='display_only' and not is_published;
   ```
   Si ~0 → exécuter `scaffold-rest-hotels.sql` via Supabase MCP `execute_sql` (chunks séparés par `\n\n`). Si ~860 → D1 fait, passer à D2.
2. **Relancer Phase C** (worker, code `scripts/editorial-pilot/src/rankings/**`) : C1 luxury_tier + match ville durci + tests, C2 gate complétude + rapport `docs/audits/rankings-completeness-gaps-2026-06-24.md`. **Puis C3** : corriger les 7 villes de `audit-city-falsepos.json` (`curtain-bluff-resort` Antigua≠Paris, 3 Venise≠Nice, 2 Charleston≠Arles, 1 Punta Maroma≠Rome) — backup avant write, match mot-entier.
3. **Reprendre Phase D2→D4** (worker) : SEED contenu (Tavily officiel + Wikidata) car `run-hotel-description-extend.ts` ignore `description_fr IS NULL` ; puis waves 0-1 + sections longues + parité EN ; puis `publish-eligible-drafts.ts` (`--dry-run` puis live). Timeouts obligatoires sur tout appel LLM (`withTimeout` + `Promise.allSettled`).
4. **Phase E** (après C + D) : refresh snapshot (`export-hotels-catalog-rest.ts`), `inspect-matrix`, regénérer les 421 seeds + 28 sous-remplis (`run-rankings-v2-bulk.ts`) + renfort pillar, acceptance prod curl FR+EN (assertions de valeurs), re-audit complétude, MAJ baseline SERP.

## Garde-fous (rappel)

- Curation : n'onboarder QUE le luxe (palace/5★/R&C/marques). Dédup strict avant insert.
- Phase 6 gelée : `booking_mode='display_only'`, aucun `Offer`/`priceValidUntil`.
- Snapshot discipline : refresh `out/hotels-catalog.json` après chaque vague publish avant de regénérer.
- Arbre partagé : `git pull --rebase` avant push, typecheck + `validate:skills` verts, exclure `tmp-*`.
