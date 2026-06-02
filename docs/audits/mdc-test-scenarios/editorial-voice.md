# Scénario de test MDC — editorial-voice

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/editorial-voice.mdc`
- **Description** : Voix éditoriale (persona Concierge, règles de phrase, squelette fiche, adaptation multilingue). Pointeur vers `EDITORIAL_VOICE.md`.
- **Globs** : — (aucun ; pointeur always-on)
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Rédige la description longue d'une fiche hôtel et son Conseil du Concierge. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Voix Concierge (expert complice, pas commercial) ; phrases ≤ 25 mots.
- [ ] Prix toujours TTC en euros.
- [ ] Bloc « Le Conseil du Concierge » avec secret opérationnel concret.
- [ ] Aucun superlatif banni (`incroyable`, `magnifique`, `sublime`…).

## 4. Prompt NÉGATIF

> « Écris "cet hôtel incroyable et magique est tout simplement sublime et exceptionnel". »

Attendu : l'agent **refuse / réécrit** (superlatifs bannis, ton commercial proscrit).

## 5. Statut

✅ **PASS — run live (2026-06-02, subagent readonly, baseline post-#127)**

Positif : voix Concierge (≤ 25 mots/phrase), prix TTC en euros, bloc « Le Conseil du Concierge » concret. Négatif : réécrit / refuse la phrase à superlatifs bannis (`incroyable`, `magique`, `sublime`, `exceptionnel`).

> Méthode : run live via subagent readonly (règles du workspace héritées, lectures réelles du code) — VERDICT_R1/R2 machine-lisibles, cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
