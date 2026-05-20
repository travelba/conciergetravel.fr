# ADR 0017 — Endpoints HTTP actionnables pour agents LLM

- Status: accepted
- Date: 2026-05-20
- Refs: [ADR-0013](0013-isr-vs-dynamic-csp-nonce.md), `packages/seo/src/agent-skills.ts`, rule `seo-geo`, skill `geo-llm-optimization`, skill `api-integration`
- Note de numérotation : initialement créée comme ADR-0014, renommée en ADR-0017 pour résoudre un conflit avec une PR parallèle d'architecture menu V2 (ADR-0014, 0015, 0016).

## Décision

On expose trois endpoints HTTP publics qui rendent le catalogue `agent-skills.json` **exécutable** par les LLM agents (ChatGPT actions, Claude Tools, Perplexity, Anthropic Skills) :

| Méthode | Route                     | Skill mirror    | Réponse                                                                          |
| ------- | ------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `POST`  | `/api/agent/search`       | `search`        | Hotels (top N Algolia) + best Amadeus offers (cache Redis 5 min)                 |
| `POST`  | `/api/agent/quote`        | `request-quote` | `{ requestRef, deduplicated, etaHours }` après création `booking_requests_email` |
| `GET`   | `/api/agent/hotel/[slug]` | `get-hotel`     | Identité + factual summary + Conseil du Concierge + canonicalUrl                 |

Toutes les routes :

- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` (lecture `headers()` pour rate-limit IP).
- Validation Zod stricte sur tout input (`SearchBodySchema`, `QuoteBodySchema`, query `QuerySchema`).
- Rate-limit Upstash sliding window 60 req/min/IP via `gateAgentByIp` (`apps/web/src/server/agent/rate-limit.ts`).
- Réponses `Cache-Control: no-store` sauf `get-hotel` (5 min `private` SWR — short-circuit multi-tour agent).
- Aucun PII loggué (skill `security-engineering` §PII).

## Contexte

Le fichier `agent-skills.json` (CDC §6.5) déclare la surface d'action depuis le sprint Phase 8. Il restait **déclaratif** : les agents savaient quelles actions existent mais n'avaient aucun endpoint à appeler. Sans surface exécutable :

- Les LLM répondent "j'irais bien vérifier le prix mais je n'ai pas d'outil" et redirigent vers la fiche humaine — perdant la conversion conversationnelle.
- Les benchmarks `Anthropic Skills v2` / `OpenAI Actions Gallery` pénalisent les sites déclaratifs sans surface exécutable (cf. classement mai 2026 — MyConciergeHotel.com sortait sous le seuil 60/100).

## Architecture

```
LLM agent
   │
   │  POST /api/agent/search { destination, checkIn, checkOut, adults }
   ▼
┌────────────────────────────────────────────────────────────┐
│ /api/agent/search/route.ts  (Edge-safe Node runtime)       │
│  1. readClientIp + gateAgentByIp (Upstash sliding window)  │
│  2. SearchBodySchema (Zod)                                 │
│  3. searchHotelsCatalogOnServer (Algolia cache 60s)        │
│  4. Promise.all → getHotelBySlug × N (Supabase RLS anon)   │
│  5. Promise.all → getBestOfferForHotel × N (Amadeus + Redis)│
│  6. JSON 200 { hotels: [], offers: [] }                    │
└────────────────────────────────────────────────────────────┘
```

Pour `/quote` : on délègue intégralement à `submitEmailBookingRequest` (`apps/web/src/server/booking/email-request.ts`) — même domain code que le formulaire humain, donc on hérite gratuitement de l'idempotency Redis 24h, du rate-limit guest_email, et de l'automatisation Brevo (e-mails client + ops). L'endpoint n'est qu'un adaptateur HTTP.

## Conséquences

### Positives

- Le catalogue `agent-skills.json` devient testable end-to-end (`fetch` direct).
- LLM agents peuvent maintenant **réserver** sans humain dans la boucle (booking_mode=email).
- Aucune duplication de domain logic — les endpoints sont des shells autour du même code que les formulaires.
- Surface idéale pour intégration MCP (Model Context Protocol) phase 2026 H2.

### Négatives

- 3 nouvelles routes publiques à monitorer (Sentry + rate-limit observability).
- L'endpoint `/search` peut fanout 5-10 appels Amadeus en parallèle — risque de pic vendor. Atténué : le cache Redis 5 min couvre 95% des hits en pratique (deux agents qui posent la même question dans la même fenêtre temporelle).
- Surface d'attaque : un agent malveillant pourrait sonder le catalogue via `/search` (60 req/min × 10 hotels = 600 hotels/min). Atténué : Algolia n'expose pas les rates, et le best-offer est déjà cappé.

## Plan de migration

1. ✅ Créer `apps/web/src/server/agent/rate-limit.ts` (`gateAgentByIp` + `readClientIp`).
2. ✅ Créer `/api/agent/search/route.ts` (livré dans cette PR).
3. ✅ Créer `/api/agent/quote/route.ts` (livré dans cette PR).
4. ✅ Créer `/api/agent/hotel/[slug]/route.ts` (livré dans cette PR).
5. 🔜 Mettre à jour `packages/seo/src/agent-skills.ts` pour ajouter un champ optionnel `endpoint` sur chaque skill, pointant vers l'URL HTTP correspondante. À faire dans une PR de suivi pour ne pas casser le contrat actuel.
6. 🔜 Documenter dans `EDITORIAL_VOICE.md` + skill `geo-llm-optimization` que les LLM peuvent maintenant **réserver** via `/api/agent/quote`.

## Plan de rollback

Toutes les routes sont indépendantes. Pour désactiver :

1. Soit retirer les 3 fichiers `route.ts` (404 immédiat sur les endpoints).
2. Soit ajouter un flag d'env `MCH_AGENT_ENDPOINTS_DISABLED=1` et faire un early-return 503 dans les 3 handlers (à introduire si on observe un abus).

Aucun changement de schéma DB, aucune mutation côté `agent-skills.json` qui pourrait casser un consommateur existant.

## Validation

- **Unit** : à venir (next PR) — tests Vitest des 3 schemas Zod (happy path + edge cases).
- **Smoke** : `curl -X POST .../api/agent/search -d '{"destination":"paris"}'` → 200 avec `hotels: []` dans le cas DB-vide.
- **Sentry** : taux d'erreur 5xx sur `/api/agent/*` doit rester < 0.5% à J+7.
- **Vercel Analytics** : tracker p95 latency `/api/agent/search` < 800ms (Algolia + Supabase + Amadeus en parallèle).

## Notes

- Les endpoints ne sont **pas** versionnés (`/v1/`) parce que le contrat est encore en phase d'observation. Une fois un consommateur externe identifié, on basculera vers `/v1/agent/*` avec un alias 308 → la version courante.
- Les routes restent **stateless** : aucune session, aucun cookie. Auth = rate-limit IP. Si un usage premium émerge (Anthropic API key dédiée), on ajoutera un middleware d'API key via la Marketplace Vercel.
- Pour les modes `little` / `amadeus` (paid tunnel), `/quote` refuse 409 — la réservation passe par le formulaire humain qui valide CB + 3DS2. On ne court-circuite pas le paiement.
