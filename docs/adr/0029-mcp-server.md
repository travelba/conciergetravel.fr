# ADR 0029 — Serveur MCP (Model Context Protocol) MyConciergeHotel.com

- Status: accepted
- Date: 2026-06-03
- Refs: [ADR-0017](0017-agent-actionable-endpoints.md) (endpoints actionnables), [ADR-0025](0025-booking-integration-last-brick.md) (gel booking Phase 6), [ADR-0026](0026-hotel-directory-annuaire.md) (annuaire), `packages/seo/src/agent-skills.ts`, skill `geo-llm-optimization`, skill `api-integration`
- Note de numérotation : ce Lot 4 a été cadré sous l'étiquette « ADR-0027 » dans le plan d'origine, mais le slot `0027` était déjà occupé par `0027-csp-model-evolution.md` (et `0028` par `0028-mdc-glob-overlap.md`), tous deux créés en parallèle le 2026-06-02. L'ADR MCP prend donc le premier numéro libre, **0029** — même résolution de collision que la note de l'[ADR-0017](0017-agent-actionable-endpoints.md).

## Décision

On expose un **serveur MCP (Model Context Protocol)** dans `apps/web`, transport **Streamable HTTP**, monté sur la route catch-all `apps/web/src/app/api/[transport]/route.ts` (`basePath: '/api/mcp'`). C'est la couche agentique standardisée (modèle Expedia) **par-dessus** les surfaces des Lots 0→3 — sans dupliquer aucune logique métier.

Principes structurants :

1. **Result-builders partagés (zéro duplication).** Le shaping JSON de chaque surface `/api/agent/*` vit désormais dans une fonction pure `buildXxxResult(...)` (`apps/web/src/server/mcp/builders/**`). Le `route.ts` HTTP **et** le tool MCP appellent le même builder → parité de contrat garantie par construction. Les `route.ts` deviennent des shells fins (gate IP + parse input + `agentJson`).
2. **Catalogue dérivé du manifeste.** Les 26 tools sont enregistrés depuis `DEFAULT_AGENT_SKILLS` (`@mch/seo`) — nom + description repris verbatim, source de vérité unique partagée avec `/.well-known/agent-skills.json`. Les schémas d'entrée sont des shapes Zod (`apps/web/src/server/mcp/schemas.ts`) qui normalisent le drift historique `checkin/checkout` (manifeste) → `checkIn/checkOut` (contrat booking).
3. **Gel Phase 6 data-driven.** Les capacités tarif/réservation (`compare-prices`, `request-quote`, `booking`) court-circuitent via `apps/web/src/server/mcp/phase6.ts` vers une enveloppe `{ status: 'frozen', phase: 6, reason: 'booking_apis_not_wired', bookingMode }` **sans aucun appel vendor** (Makcorps / Amadeus / Brevo). Le garde lit `booking_mode` en base (lecture DB, jamais vendor) pour rester correct le jour où un hôtel bascule. `search` renvoie le catalogue éditorial avec `offers: []` annotées frozen.
4. **Resources read-only.** Le serveur expose `hotels.jsonl`, `llms.txt`, `llms-full.txt` (réutilisation des GET handlers existants) et un manifeste `phase6` lisible (`apps/web/src/server/mcp/register-resources.ts`).
5. **Découverte WebMCP.** Header `Link: </api/mcp>; rel="mcp"` ajouté à côté du `rel="agent-skills"` existant (`next.config.ts` + `proxy.ts`), et endpoint référencé dans `llms.txt`.

Toutes les surfaces réutilisent le **même gate de rate-limit IP** (`gateAgentByIp`, 60 req/min/IP, fail-open) que les endpoints HTTP — côté MCP via `apps/web/src/server/mcp/gate.ts` qui lit l'IP depuis `extra.requestInfo.headers`.

## Contexte

ADR-0017 a rendu le catalogue `agent-skills.json` exécutable en HTTP (24 endpoints). Les clients MCP (Claude Desktop, MCP Inspector, agents tiers) attendent toutefois un **transport MCP standard** (`initialize` / `tools/list` / `tools/call`) plutôt que des appels HTTP ad hoc. Sans serveur MCP :

- les agents MCP ne découvrent pas la surface d'action et retombent sur du scraping HTML ;
- chaque intégration ré-implémente le mapping skill → appel HTTP, sans schéma d'entrée typé ni annotations (`readOnlyHint`).

Le risque principal était la **duplication** : recopier le shaping JSON des `route.ts` dans les tools MCP aurait créé deux contrats à maintenir. D'où le pattern result-builders.

## Architecture

```
Client MCP (Claude Desktop / MCP Inspector / agent tiers)
   │  POST /api/mcp  (Streamable HTTP : initialize / tools/list / tools/call)
   ▼
┌──────────────────────────────────────────────────────────────┐
│ app/api/[transport]/route.ts  — createMcpHandler (mcp-handler)│
│   registerMchTools(server)  ← DEFAULT_AGENT_SKILLS (@mch/seo) │
│   registerMchResources(server)                                │
└──────────────────────────────────────────────────────────────┘
   │ chaque tool : gateMcpTool(IP) → builder pur → toMcpResult()
   ▼
┌──────────────────────────────────────────────────────────────┐
│ server/mcp/builders/**  (buildHotelResult, buildSearchResult…)│
│   ← MÊME builder appelé par app/api/agent/**/route.ts         │
│   pricing/booking → server/mcp/phase6.ts (frozen, 0 vendor)   │
└──────────────────────────────────────────────────────────────┘
```

SSE est **désactivé** : le fallback SSE de `mcp-handler` nécessite un Redis state-store incompatible avec l'URL REST Upstash, et le transport SSE est déprécié dans la spec MCP au profit du Streamable HTTP. Upstash reste utilisé pour le rate-limit, pas pour l'état SSE.

## Conséquences

### Positives

- **Une seule source de vérité** par surface (builder) → parité HTTP ↔ MCP garantie, testée (`register-tools.test.ts`, `to-mcp-result.test.ts`).
- Le gel Phase 6 est **inviolable côté MCP** : les builders frozen n'importent même pas les adapters vendor — un test (`phase6.test.ts`) asserte 0 appel à `getPriceComparison` / `submitEmailBookingRequest`.
- Découverte standardisée (Link header `rel="mcp"`) sur **toute** réponse HTML.
- Les `route.ts` HTTP, devenus des shells, sont plus simples à auditer.

### Négatives

- Une route publique de plus à monitorer (`/api/mcp`). Atténué : même gate IP + observabilité que `/api/agent/*`.
- Le catch-all `[transport]` coexiste avec les routes statiques `/api/agent/*` : l'ordre de résolution Next.js privilégie les routes statiques, mais toute future route `/api/<x>` doit rester en dehors du segment dynamique.
- Pas de smoke handshake protocolaire complet en CI (le transport Streamable HTTP exige un runtime Next). Atténué : smoke au niveau registration (`tools/list` via serveur mock + `tools/call` en invoquant le callback) + validation manuelle MCP Inspector.

## Plan de rollback

1. Retirer `apps/web/src/app/api/[transport]/route.ts` → plus d'endpoint MCP (les `/api/agent/*` HTTP continuent de fonctionner, ils ne dépendent pas du transport MCP).
2. Retirer le header `Link … rel="mcp"` (`next.config.ts` + `proxy.ts`).

Les builders restent en place : ils sont désormais le cœur partagé des routes HTTP, leur retrait n'est pas souhaitable et n'est pas requis pour désactiver MCP.

## Validation

- **Unit / contrat** : `apps/web/src/server/mcp/*.test.ts` — couverture catalogue (26 tools ↔ 26 skills), mapping `BuilderResponse → CallToolResult` (frozen ≠ erreur), gel (0 appel vendor).
- **Smoke** : serveur mock capture 26 `registerTool`, un `tools/call` read (`booking` → frozen, `filter` → hint) retourne un `structuredContent` non-erreur.
- **User-acceptance** : MCP Inspector / Claude Desktop → `tools/list` montre 26 tools, un read renvoie de la donnée réelle, un tool tarifaire renvoie `status: 'frozen'`.

## Notes

- Pas d'auth API-key : rate-limit IP suffit en phase d'observation (cohérent ADR-0017). Une clé dédiée (Marketplace Vercel) sera ajoutée si un consommateur premium émerge.
- `filter` et `booking` n'ont pas d'endpoint HTTP : `filter` est exposé comme hint de raffinement, `booking` comme capacité `frozen` — tous deux restent annoncés pour que l'agent connaisse le vocabulaire.
- Aucun `Offer` JSON-LD, aucun tunnel de paiement : le gel Phase 6 (ADR-0025) est intégralement respecté.
