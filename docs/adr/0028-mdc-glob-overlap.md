# ADR-0028 — MDC glob overlap & rule-attachment strategy

- Status: Accepted
- Date: 2026-06-02
- Deciders: agent (arbitrage délégué explicitement par le PO — issue #128 « Tu arbitres #128 quand tu veux »)
- Supersedes: —
- Superseded by: —
- Related: audit MDC #125 (`docs/audits/2026-06-02-mdc-quality-audit.md` §7), Vague F-bis #127 (items mécaniques 1-4), N2 run #129 (`docs/audits/2026-06-02-mdc-n2-run-results.md` §4)

> Cette ADR tranche **uniquement** la stratégie d'_attachement_ des règles MDC
> (quand une règle se charge en contexte). Elle ne touche pas au **contenu**
> métier des règles. Indépendante d'ADR-0027 (CSP) et d'ADR-0026 (rendu).

## Context

L'audit MDC (#125, §7) a relevé un **overlap de globs** : éditer un fichier de
fiche hôtel auto-attache une douzaine de MDC simultanément, diluant les signaux
et gaspillant le budget contexte. L'item a été **sorti du périmètre F-bis**
(#127, mécanique) et tracé dans #128 comme décision de gouvernance.

L'extraction des frontmatter réels (2026-06-02, baseline post-#127) corrige une
hypothèse de l'issue : les règles **Vague A** (`01`, `10`, `11`, `12`, `14`,
`20`, `30`, `40`, `41`) sont **toutes `alwaysApply: false`** — elles
s'auto-attachent seulement sur match de glob. Le vrai moteur du
sur-déclenchement est ailleurs :

> **Constat structurant** — plusieurs règles portent un glob **étroit et
> correct**, mais sont déclarées `alwaysApply: true`. Or `alwaysApply: true`
> **écrase le glob** : la règle se charge sur **tous** les fichiers, son glob
> étroit devient cosmétique.

Conséquence mesurée sur un fichier **hors surface**, ex.
`packages/domain/loyalty/tier.ts` : les 14 règles `alwaysApply: true` se
chargent toutes, dont `hotel-detail-page`, `photo-quality`, `e2e-testing`,
`integrations-api`, `supabase-rls`, `seo-geo`, `nextjs-app-router` — **toutes
hors-sujet** pour un fichier de domaine pur. Le glob étroit qu'elles possèdent
déjà est ignoré.

### Frontmatter réel (baseline post-#127)

| MDC                                    | alwaysApply | glob présent                         | glob étroit ?      |
| -------------------------------------- | ----------- | ------------------------------------ | ------------------ |
| `code-conventions`                     | true        | `**/*.{ts,tsx}`                      | non (universel)    |
| `architecture-layers`                  | true        | `{packages,apps}/**`                 | non (universel)    |
| `security-csp`                         | true        | `{apps,packages}/**`                 | non (universel)    |
| `observability-perf`                   | true        | `{apps,packages}/**`                 | non (large)        |
| `editorial-voice`                      | true        | —                                    | n/a (pointer)      |
| `skills-capitalisation`                | true        | —                                    | n/a (fin de tâche) |
| `user-acceptance-before-commit`        | true        | —                                    | n/a (gate process) |
| `nextjs-app-router`                    | true        | `apps/web/**`                        | moyen              |
| `seo-geo`                              | true        | `{packages/seo,apps/web/src/app}/**` | moyen              |
| `hotel-detail-page`                    | **true**    | `app/[locale]/hotel/[slug]/**`       | **oui — écrasé**   |
| `photo-quality`                        | **true**    | liste explicite hotel/cloudinary     | **oui — écrasé**   |
| `e2e-testing`                          | **true**    | `apps/web/{e2e,src/server}/**`       | **oui — écrasé**   |
| `integrations-api`                     | **true**    | `packages/integrations/**`           | **oui — écrasé**   |
| `supabase-rls`                         | **true**    | `{packages/db,apps/admin}/**`        | **oui — écrasé**   |
| (Vague A : 01/10/11/12/14/20/30/40/41) | false       | variable                             | auto-attach OK     |

## Decision drivers

- **D1** — Réduire le bruit de contexte sur les fichiers hors-surface sans
  perdre la couverture là où une règle est pertinente.
- **D2** — Ne jamais rater un **guardrail** transverse (sécurité, layering, TS
  strict, PII, process commit/acceptance) : l'omission silencieuse y coûte cher.
- **D3** — Maintenance faible : préférer un changement qui survit aux
  réorganisations sans micro-gestion des globs.
- **D4** — Déterminisme : limiter la dépendance au matching de description
  (peu prévisible) pour les règles qui ont une surface claire.
- **D5** — Réversibilité immédiate (flip d'un flag).

## Considered options

### Option α — Restriction des globs (issue #128)

Resserrer le glob de chaque règle transverse aux surfaces strictement utiles,
en gardant l'auto-attach.

- **Pros** : reste auto-attach, granularité fine.
- **Cons** : pour les règles `alwaysApply: true` à glob étroit, resserrer le
  glob **ne change rien** (le flag l'écrase). Inefficace seul ; maintenance
  manuelle des globs au fil des réorganisations.

### Option β — `alwaysApply: false` généralisé (manuel)

Passer toutes les transverses en déclenchement manuel (`@rule`).

- **Pros** : zéro surcharge passive.
- **Cons** : risque d'oubli sur les **guardrails** (sécurité, layering) →
  régression silencieuse. Perte de la discipline automatique. Contraire à D2.

### Option γ — Hybride (retenue)

Distinguer trois familles et appliquer la bonne mécanique d'attachement :

1. **Guardrails universels** → restent `alwaysApply: true` (toujours en
   contexte, glob non pertinent).
2. **Playbooks de surface** (déjà dotés d'un glob étroit/moyen) → passent en
   `alwaysApply: false` pour que **le glob existant prenne enfin effet**
   (auto-attach ciblé).
3. **Méta / routage / pointeurs** → `alwaysApply: false` sans glob (déjà le
   cas pour la Vague A), déclenchement par description / `@rule`.

- **Pros** : règle le sur-déclenchement **par flip de flag** (D1, D3, D5),
  préserve les guardrails (D2), rend l'attachement déterministe par surface
  (D4). N'exige presque aucun resserrement de glob (les globs existent déjà).
- **Cons** : 3 règles « no-glob always-on » (`editorial-voice`,
  `skills-capitalisation`, `user-acceptance-before-commit`) restent passives
  partout — assumé (coût faible, valeur process élevée).

## Decision

**Option γ retenue.** Reclassification (appliquée par la PR
`chore/mdc-globs-overlap-fix`, deliverable de #128) :

### Flip `alwaysApply: true → false` (7 règles à glob étroit/moyen)

`hotel-detail-page`, `photo-quality`, `e2e-testing`, `integrations-api`,
`supabase-rls`, `nextjs-app-router`, `seo-geo`. → Leur glob existant scope
enfin leur chargement. Aucune modification de glob nécessaire (les globs sont
déjà corrects).

### Conserver `alwaysApply: true` (guardrails — 7 règles)

`code-conventions`, `architecture-layers`, `security-csp`, `observability-perf`
(globs universels, omission coûteuse), et les 3 sans glob (`editorial-voice`,
`skills-capitalisation`, `user-acceptance-before-commit` — process / pointeur).

### Inchangé (déjà sain)

Les 9 règles Vague A sont déjà `alwaysApply: false` + auto-attach. Optionnel
(priorité basse, même PR) : resserrer les globs `apps/web/**` trop larges de
`10`/`11`/`12`/`30`/`40`/`41` vers les répertoires de routes SEO réellement
concernés. Non bloquant.

## Consequences

- **Baseline « always-on » : 14 → 7** règles. Les playbooks de surface ne se
  chargent plus que sur leur surface.
- **Sur une fiche hôtel** : `hotel-detail-page`, `photo-quality`, `seo-geo`,
  `nextjs-app-router` s'attachent toujours **via glob** (pertinent) — couverture
  préservée là où elle compte.
- **Sur un fichier de domaine / migration / intégration** : les règles
  hors-sujet disparaissent du contexte. Signal plus net, budget économisé.
- **Cible indicative #128** atteinte : aucun chemin hors-surface ne déclenche
  plus la pile complète des playbooks.
- **Réversible** : re-flip d'un flag si une régression de couverture est
  observée.

## Application plan (deliverable #128)

1. PR `chore/mdc-globs-overlap-fix` : flip des 7 `alwaysApply` (frontmatter
   uniquement, EOL LF), + resserrement optionnel des globs Vague A.
2. Mettre à jour `docs/audits/2026-06-02-mdc-quality-audit.md` §7 (résolution).
3. Validation N2 ciblée : rejouer les scénarios des surfaces affectées
   (fiche hôtel, domaine, intégration, migration) pour confirmer
   non-régression de couverture (cf. #129 §4).
4. Fermer #128.

## References

- Audit MDC : `docs/audits/2026-06-02-mdc-quality-audit.md` §7
- N2 run results : `docs/audits/2026-06-02-mdc-n2-run-results.md` §4 (réserve déclenchement)
- Issue : #128
- Cursor docs — Rule types : Always / Auto Attached (glob) / Agent Requested (description) / Manual
