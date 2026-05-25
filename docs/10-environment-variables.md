# Environment variables — MyConciergeHotel.com

Toute variable d'environnement utilisée par le projet est listée ici. Le fichier `.env.example` est la source synchronisée pour le scaffolding local. La validation runtime est assurée par `@mch/config/env` (t3-env + Zod) qui fait échouer le boot si une variable obligatoire est manquante ou invalide.

> Convention : préfixe `NEXT_PUBLIC_` = exposé au client. Tout le reste est server-only.

## Quotidien — flow opérationnel (ADR-0018)

**Source de vérité : Vercel.** Tous les secrets vivent dans Vercel Project Settings (3 envs : Development / Preview / Production). Localement, le script `pnpm bootstrap:env` synchronise tout en une commande.

### Première mise en place (une fois)

```powershell
# 1. Installer Vercel CLI globalement
pnpm add -g vercel

# 2. Lier le repo au projet Vercel (idempotent — relancer ne casse rien)
vercel link --yes --project=myconciergehotel-com --scope=travelba

# 3. Vérifier que Vercel contient bien toutes les vars de .env.example
#    https://vercel.com/travelba/myconciergehotel-com/settings/environment-variables

# 4. Pull les secrets dans .env.local + apps/web/.env.local
pnpm bootstrap:env
```

### Au quotidien

```powershell
# Rotation d'un secret : modifier dans Vercel UI, puis :
pnpm bootstrap:env                  # refresh .env.local + apps/web/.env.local

# Nouveau dev qui clone le repo :
pnpm install && pnpm bootstrap:env  # une commande, tout est prêt
```

### Clés "local-only" (LLM, recherche éditoriale)

Les clés utilisées **uniquement** par les pipelines `scripts/editorial-pilot/*` et qui n'atteignent jamais la production web app peuvent rester locales. Elles sont **préservées automatiquement** lors des `bootstrap:env`. Pour les ajouter :

```powershell
# Ajouter la clé EN BAS du fichier, sous le marqueur "# --- local-only"
Add-Content .env.local 'OPENAI_API_KEY="sk-proj-…"'
Add-Content .env.local 'ANTHROPIC_API_KEY="sk-ant-…"'
Add-Content .env.local 'TAVILY_API_KEY="tvly-prod-…"'
Add-Content .env.local 'DATATOURISME_API_KEY="…"'

# Re-lancer bootstrap → la section "local-only" est préservée
pnpm bootstrap:env
```

> ⚠️ **Anti-pattern** : ne JAMAIS coller une clé dans `.cursor/mcp.json` du repo. Les MCP Cursor (Tavily, Cloudinary, Resend, Vercel, …) gèrent leur OAuth tout seuls via le store sécurisé Cursor. Les MCP custom déclarés dans `~/.cursor/mcp.json` user-level utilisent l'interpolation `${VAR}` qui lit depuis shell env Windows (`setx`).

### Options du script

```powershell
pnpm bootstrap:env                  # default: pull development env
pnpm bootstrap:env --env=preview    # pull preview env
pnpm bootstrap:env --env=production # pull production env (handle with care)
pnpm bootstrap:env --no-mirror      # do NOT copy to apps/web/.env.local
pnpm bootstrap:env --no-check       # skip the .env.example cross-check
```

Le cross-check par défaut affiche les clés présentes dans `.env.example` mais absentes ou vides dans Vercel. C'est ainsi qu'on garde le portfolio Vercel synchrone avec les besoins runtime.

### Référence

- Décision et alternatives écartées : [ADR-0018](adr/0018-env-vars-vercel-source-of-truth.md)
- Script : [`scripts/bootstrap/env.mjs`](../scripts/bootstrap/env.mjs)
- Skill gotchas Windows : [`.cursor/skills/windows-dev-environment/SKILL.md`](../.cursor/skills/windows-dev-environment/SKILL.md) Rule 9 + Rule 9 quater

## Public site

| Variable                     | Type         | Scope           | Description                                                           |
| ---------------------------- | ------------ | --------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`       | URL          | client + server | URL canonique (sans slash final). Ex. `https://myconciergehotel.com`. |
| `NEXT_PUBLIC_SITE_NAME`      | string       | client + server | "MyConciergeHotel".                                                   |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `fr` \| `en` | client + server | Locale par défaut. `fr` en MVP.                                       |

## Supabase

| Variable                        | Type         | Scope           | Description                                                                                   |
| ------------------------------- | ------------ | --------------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL          | client + server | URL projet.                                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | string       | client + server | Clé anon pour client SSR.                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | string       | server only     | Clé service role pour migrations + Payload + admin server. **Ne jamais exposer côté client.** |
| `SUPABASE_DB_URL`               | postgres URL | server only     | DSN PostgreSQL utilisé par Payload + scripts de migration.                                    |
| `SUPABASE_PROJECT_REF`          | string       | server only     | Référence projet (ex. `abcdefgh`) pour la CLI Supabase.                                       |

## Upstash Redis

| Variable                   | Type   | Scope  | Description    |
| -------------------------- | ------ | ------ | -------------- |
| `UPSTASH_REDIS_REST_URL`   | URL    | server | Endpoint REST. |
| `UPSTASH_REDIS_REST_TOKEN` | string | server | Token REST.    |

## Algolia

| Variable                         | Type   | Scope           | Description                    |
| -------------------------------- | ------ | --------------- | ------------------------------ |
| `NEXT_PUBLIC_ALGOLIA_APP_ID`     | string | client + server | App ID.                        |
| `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` | string | client + server | Clé search-only (sécurisable). |
| `ALGOLIA_ADMIN_API_KEY`          | string | server          | Clé admin pour indexation.     |
| `ALGOLIA_INDEX_PREFIX`           | string | server          | `dev_`, `staging_`, `prod_`.   |

## Amadeus

| Variable                         | Type                   | Scope  | Description                               |
| -------------------------------- | ---------------------- | ------ | ----------------------------------------- |
| `AMADEUS_ENV`                    | `test` \| `production` | server | Environnement Amadeus.                    |
| `AMADEUS_API_KEY`                | string                 | server | Client ID OAuth2.                         |
| `AMADEUS_API_SECRET`             | string                 | server | Client secret OAuth2.                     |
| `AMADEUS_PAYMENT_WEBHOOK_SECRET` | string                 | server | HMAC pour `/api/webhook/amadeus-payment`. |

## Little Hotelier

| Variable                   | Type   | Scope  | Description   |
| -------------------------- | ------ | ------ | ------------- |
| `LITTLE_HOTELIER_API_BASE` | URL    | server | Base URL API. |
| `LITTLE_HOTELIER_API_KEY`  | string | server | Clé API.      |

## Makcorps + Apify

| Variable               | Type   | Scope  | Description                                 |
| ---------------------- | ------ | ------ | ------------------------------------------- |
| `MAKCORPS_API_BASE`    | URL    | server | Base URL Makcorps.                          |
| `MAKCORPS_API_KEY`     | string | server | Clé API Makcorps.                           |
| `MAKCORPS_DAILY_QUOTA` | number | server | Plafond quotidien d'appels (sécurité coût). |
| `APIFY_API_TOKEN`      | string | server | Token Apify (fallback).                     |
| `APIFY_HOTEL_ACTOR_ID` | string | server | ID de l'actor Apify utilisé.                |

## Google Places

| Variable                | Type   | Scope  | Description                     |
| ----------------------- | ------ | ------ | ------------------------------- |
| `GOOGLE_PLACES_API_KEY` | string | server | Clé Places API (Place Details). |

## Brevo

| Variable                   | Type   | Scope  | Description                                |
| -------------------------- | ------ | ------ | ------------------------------------------ |
| `BREVO_API_KEY`            | string | server | Clé API transactional.                     |
| `BREVO_SENDER_EMAIL`       | email  | server | Adresse expéditeur.                        |
| `BREVO_SENDER_NAME`        | string | server | Nom expéditeur.                            |
| `BREVO_INTERNAL_OPS_EMAIL` | email  | server | Adresse interne pour demandes hors-réseau. |

## Sentry

| Variable                 | Type   | Scope           | Description                                      |
| ------------------------ | ------ | --------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN` | URL    | client + server | DSN.                                             |
| `SENTRY_AUTH_TOKEN`      | string | CI only         | Upload des source maps.                          |
| `SENTRY_ORG`             | string | CI only         | Slug org.                                        |
| `SENTRY_PROJECT_WEB`     | string | CI only         | `cct-web`.                                       |
| `SENTRY_PROJECT_ADMIN`   | string | CI only         | `cct-admin`.                                     |
| `SENTRY_ENV`             | string | server          | `dev` \| `preview` \| `staging` \| `production`. |
| `SENTRY_RELEASE`         | string | build time      | git SHA.                                         |

## Cloudinary

| Variable                | Type   | Scope           | Description   |
| ----------------------- | ------ | --------------- | ------------- |
| `CLOUDINARY_CLOUD_NAME` | string | client + server | Cloud name.   |
| `CLOUDINARY_API_KEY`    | string | client + server | Clé publique. |
| `CLOUDINARY_API_SECRET` | string | server          | Secret.       |

## Payload CMS

| Variable                    | Type   | Scope  | Description                              |
| --------------------------- | ------ | ------ | ---------------------------------------- |
| `PAYLOAD_SECRET`            | string | server | Secret de signature des cookies Payload. |
| `PAYLOAD_PUBLIC_SERVER_URL` | URL    | server | URL publique du back-office.             |

## Cron / interne

| Variable            | Type   | Scope  | Description                                     |
| ------------------- | ------ | ------ | ----------------------------------------------- |
| `CRON_SECRET`       | string | server | Protège les routes `/api/cron/*` (Vercel Cron). |
| `REVALIDATE_SECRET` | string | server | HMAC pour la revalidation depuis Payload.       |

## Feature flags

| Variable                          | Type    | Scope  | Description                                                    |
| --------------------------------- | ------- | ------ | -------------------------------------------------------------- |
| `DATADOG_ENABLED`                 | boolean | server | Active l'instrumentation Datadog (Phase 2).                    |
| `LOYALTY_PREMIUM_BILLING_ENABLED` | boolean | server | Active la souscription tier PREMIUM (Phase 2 — voir ADR 0005). |
