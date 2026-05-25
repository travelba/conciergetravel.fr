# ADR 0018 — Vercel as single source of truth for environment variables

- Status: accepted
- Date: 2026-05-25
- Refs: [`docs/10-environment-variables.md`](../10-environment-variables.md), [`scripts/bootstrap/env.mjs`](../../scripts/bootstrap/env.mjs), skill `windows-dev-environment` Rule 9 quater, `.env.example`

## Décision

Le projet adopte **Vercel comme source de vérité unique** pour les variables
d'environnement à travers les quatre couches de consommation :

| Couche | Consommateur                                                      | Comment elle reçoit les valeurs                      |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------- |
| 1      | Production runtime (`apps/web` sur Vercel)                        | Vercel auto-injecte depuis Project Settings          |
| 2      | Preview deploys                                                   | Idem (env `Preview`, parfois override par branche)   |
| 3      | Local dev (`apps/web` via `next dev`, `apps/admin`, `packages/*`) | `pnpm bootstrap:env` → pull Vercel `development` env |
| 4      | Scripts locaux (`scripts/editorial-pilot`, `scripts/seo/*`, …)    | Idem (lecture du même `.env.local` racine)           |

Couche-5 (Cursor MCP) reste hors de ce périmètre : les plugins MCP installés
via UI Cursor (Tavily, Cloudinary, Resend, Vercel, etc.) gèrent leur token
OAuth dans le secret store Cursor — pas via `.env.local`. Les MCP custom
déclarés dans `~/.cursor/mcp.json` user-level utilisent l'interpolation
`${VAR}` qui pickup la valeur depuis l'environnement shell (`setx` sous
Windows) — jamais d'intermédiaire fichier.

## Mécanisme

### Source unique : Vercel Project Settings

```
https://vercel.com/travelba/myconciergehotel-com/settings/environment-variables
```

Trois environnements (`Development`, `Preview`, `Production`) reçoivent la
**même clé** avec les valeurs adaptées à chacun (URLs locales pour Dev,
URL preview pour Preview, URL prod pour Production). Convention :

- `Development` = valeurs qui peuvent atterrir sur la machine dev (Supabase
  prod KEY incluse car le projet utilise une seule instance Supabase
  `fsmfozxgujskluxakeoq` — pas d'instance dev séparée à date)
- `Preview` = valeurs pour les preview deploys (Algolia index `staging_`,
  Sentry env `preview`, Amadeus env `test`)
- `Production` = valeurs runtime live

Pour les secrets ultra-sensibles (clés de paiement, webhook secrets, etc.),
utiliser **Vercel Sensitive Environment Variables** : valeur écrite via UI,
jamais re-lisible, jamais pull-able. Ces secrets ne peuvent pas être utilisés
par les scripts locaux — par conception.

### Propagation locale : `pnpm bootstrap:env`

Le script [`scripts/bootstrap/env.mjs`](../../scripts/bootstrap/env.mjs) :

1. Vérifie que Vercel CLI est installé.
2. Vérifie que `.vercel/repo.json` existe (sinon : `vercel link --yes --project=myconciergehotel-com --scope=travelba`).
3. Pull les vars Vercel de l'environnement cible (`--env=development` par défaut) vers un fichier temporaire `.env.local.vercel-pull`.
4. **Merge** avec le `.env.local` racine existant :
   - Les clés Vercel écrasent les clés du même nom (Vercel = source de vérité).
   - Les clés "local-only" (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, …) sont préservées sous une section `# --- local-only` clairement séparée.
5. Mirror le résultat dans `apps/web/.env.local` (Next.js ne charge que le fichier dans son cwd — cf. skill `windows-dev-environment` Rule 9).
6. Cross-check contre `.env.example` → affiche les clés manquantes ou vides.

Le script est **idempotent** : `pnpm bootstrap:env` peut être lancé à tout
moment, et le `.env.local` reste cohérent.

### Hiérarchie des sections dans `.env.local`

```env
# Created by `pnpm bootstrap:env`
# Source: Vercel project "myconciergehotel-com" (env=development) merged with local-only keys.

# --- managed by Vercel (refreshed by bootstrap:env) -------------------------
NEXT_PUBLIC_SUPABASE_URL="…"
SUPABASE_SERVICE_ROLE_KEY="…"
...

# --- local-only (preserved across bootstrap:env runs) -----------------------
OPENAI_API_KEY="sk-…"
ANTHROPIC_API_KEY="sk-ant-…"
TAVILY_API_KEY="tvly-…"
```

Les clés sous "local-only" sont des **secrets jamais portés en production**
(typiquement les clés LLM utilisées uniquement par les pipelines éditoriaux
locaux). Si une de ces clés doit aussi être utilisée par le runtime web app,
elle doit être ajoutée à Vercel — elle migrera alors vers la section
"managed by Vercel" au prochain `bootstrap:env`.

## Conséquences

### Avantages

- **Une seule rotation par secret** : modifier dans Vercel UI → `pnpm bootstrap:env` → propagé partout (root + apps/web) en 30 sec.
- **Onboarding nouveau dev** : `pnpm install && pnpm bootstrap:env && pnpm dev:web` (3 commandes, ~3 min).
- **Audit log Vercel** : qui a modifié quoi, quand, pour quel env — visible dans le dashboard.
- **Aucun secret commit-able** : `.env.local` est gitignored via `*.local`, `.vercel/` est gitignored.
- **Cross-check automatique** : si `.env.example` ajoute une clé, le bootstrap signale qu'elle manque dans Vercel.
- **Production hardening progressif** : on peut migrer une clé en "Sensitive" Vercel sans toucher au flux dev (la clé reste dans la section local-only).

### Coûts assumés

- **Duplication entre les deux `.env.local`** : Next.js force la duplication root ↔ apps/web (cf. skill `windows-dev-environment` Rule 9). Le bootstrap automatise le mirror, donc c'est invisible au quotidien.
- **Dépendance Vercel CLI** : `pnpm bootstrap:env` échoue si CLI absent. Un nouveau dev doit installer `vercel` global (1 ligne).
- **Clés LLM toujours locales** : tant qu'on ne pousse pas `OPENAI_API_KEY` dans Vercel, les pipelines éditoriaux ne tournent pas en CI. C'est un trade-off conscient — on les migre quand on automatise les pipelines via GitHub Actions.

### État au moment de la décision (2026-05-25)

Vercel contient **5 clés** seulement, toutes liées à Supabase + `SKIP_ENV_VALIDATION`.
Le projet n'a jamais réellement exploité Vercel comme SOT pour les autres intégrations
(Amadeus, Algolia, Cloudinary, Sentry, Brevo, etc.) — leurs clés ont vécu chez les
maintainers respectifs ou dans des shell env vars. Cette ADR fixe l'orientation pour
toutes les futures intégrations : **toute nouvelle clé doit naître dans Vercel, pas
dans `.env.local`.**

## Alternatives écartées

| Alternative                                      | Pourquoi écartée                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell env vars Windows (`setx`) sans Vercel      | Pas de SOT partagée → fragmentation entre la machine du maintainer et la prod Vercel. Pas d'audit log. Rotation lourde (1 secret = 4 endroits à modifier).  |
| `dotenv-cli` + un seul `.env.local`              | Casse l'auto-loading Next.js, force `dotenv -e .env.local -- pnpm dev:web` partout. Pas d'audit log Vercel. Pas de Sensitive Variables.                     |
| Secret manager externe (1Password / Doppler)     | Coût mensuel + nouvelle dépendance. Justifié seulement si l'équipe dépasse 2-3 personnes. Vercel SOT marche jusque ~10 devs. À reconsidérer à ce moment-là. |
| Symlink `apps/web/.env.local → ../../.env.local` | Symlinks Windows nécessitent admin ou mode développeur activé. Fragile en CI. Le mirror par copie est plus robuste.                                         |
| Custom `next.config.ts` qui charge la racine     | Next.js respecte mal les overrides dotenv en mode Turbopack. Fragile. Le mirror explicite est plus prévisible.                                              |

## Migration

### Immédiat (sprint courant)

- [x] `vercel link` au root du repo (`.vercel/repo.json` créé).
- [x] Script `scripts/bootstrap/env.mjs` + entrée `bootstrap:env` dans `package.json` racine.
- [ ] Compléter dans Vercel UI les valeurs vides actuellement présentes (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) — voir doc.

### À 30 jours

- [ ] Toute clé d'intégration (Amadeus, Algolia, Cloudinary, Sentry, Brevo, Upstash) doit exister dans Vercel sur les 3 envs avec les bonnes valeurs.
- [ ] Documentation pour les clés LLM (encore local-only) dans `docs/10-environment-variables.md` § Quotidien.

### À 60-90 jours

- [ ] Migrer `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY` dans Vercel quand les pipelines éditoriaux passent en GitHub Actions / Vercel Cron.
- [ ] Marquer en "Sensitive Variable" les clés à blast radius critique (`AMADEUS_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYLOAD_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET`).

## Anti-patterns refusés

- ❌ Mettre un secret directement dans `.cursor/mcp.json` du repo (déjà arrivé pour Tavily le 2026-05-25 — fuite évitée de justesse).
- ❌ Coller un secret dans le chat ou un commit message.
- ❌ Modifier la section "managed by Vercel" du `.env.local` manuellement (sera écrasé au prochain bootstrap).
- ❌ Ajouter une clé au `.env.example` sans l'ajouter aussi dans Vercel (le bootstrap échouera au cross-check).
- ❌ Faire `vercel env pull` sans le wrapper `bootstrap:env` (écrase les keys local-only — c'est exactement le bug du premier draft de `env.mjs`).
