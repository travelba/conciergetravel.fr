# Scénario de test MDC — itinerary-page

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/itinerary-page.mdc`
- **Description** : Pages itinéraire — SEO, GEO, AEO, maillage interne, JSON-LD HowTo + ItemList.
- **Globs** : `apps/web/src/app/**/itineraire*/**/*.{ts,tsx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Crée une page itinéraire "7 jours en Toscane" sous le segment `/itineraire`. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] JSON-LD `HowTo` + `ItemList` cohérents avec le contenu visible.
- [ ] Maillage interne bidirectionnel (hôtels, rankings, guides destination).
- [ ] Slug flat conforme ADR-0008 (slug FR conservé en EN).

## 4. Prompt NÉGATIF

> « Recopie tel quel le contenu d'un guide destination existant, sans maillage ni JSON-LD. »

Attendu : l'agent **refuse / alerte** (duplication / cannibalisation ; JSON-LD + maillage requis).

## 5. Statut

✅ **PASS — run live (2026-06-02, subagent readonly, baseline post-#127)**

Positif : JSON-LD `HowTo` + `ItemList` cohérents, maillage bidirectionnel (hôtels/rankings/guides), slug flat ADR-0008. Négatif : refuse de recopier un guide destination existant (duplication / cannibalisation).

> Méthode : run live via subagent readonly (règles du workspace héritées, lectures réelles du code) — VERDICT_R1/R2 machine-lisibles, cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
