---
name: mcp-server-development
description: Building the public MCP (Model Context Protocol) server for MyConciergeHotel.com — exposing the OTA (hotel search, offers, quotes, concierge content) as MCP tools for AI agents. Covers transport, tool design, Zod schemas, auth, rate limiting, reuse of the ADR-0017 agent endpoints, and testing. Use when creating or modifying any MCP server, MCP tool, or agent-facing executable surface.
---

# MCP server development — MyConciergeHotel.com

Strategic goal: make MyConciergeHotel.com **bookable by AI agents** (Claude,
ChatGPT, Perplexity, vertical travel agents). The MCP server is the executable
counterpart of the GEO strategy — `agent-skills.json` declares, ADR-0017 HTTP
endpoints execute, MCP makes it a first-class protocol surface.

## Triggers

Invoke when:

- Creating or modifying the public MCP server (tools, resources, prompts).
- Adding a new agent-actionable capability (search, quote, hotel detail,
  itineraries, concierge advice).
- Touching `/api/agent/*` routes or `packages/seo/src/agent-skills.ts`
  (the three surfaces must stay in sync).
- Wiring MCP auth, rate limiting, or observability.

## Non-negotiable rules

### One domain, three surfaces (no duplication)

The MCP server is a **thin protocol adapter** over the exact same domain code
as the human UI and the ADR-0017 HTTP endpoints:

| Capability      | Domain code (single source of truth)                   | HTTP (ADR-0017)           | MCP tool       |
| --------------- | ------------------------------------------------------- | ------------------------- | -------------- |
| Search hotels   | `searchHotelsCatalogOnServer` + `getBestOfferForHotel` | `POST /api/agent/search`  | `search_hotels`|
| Hotel detail    | `getHotelBySlug`                                        | `GET /api/agent/hotel/…`  | `get_hotel`    |
| Request a quote | `submitEmailBookingRequest`                             | `POST /api/agent/quote`   | `request_quote`|

- New MCP tool ⇒ the domain function lives in `apps/web/src/server/` or
  `packages/domain` first; the MCP handler only validates input, calls it,
  shapes output. If logic exists only in the MCP layer, the PR is refused.
- Reuse the **same Zod schemas** (`SearchBodySchema`, `QuoteBodySchema`, …) as
  the HTTP routes — convert with `zod-to-json-schema` for tool `inputSchema`.
  Two diverging schemas for one capability is the #1 drift bug.

### Server shape & transport

- Build on the official `@modelcontextprotocol/sdk`, **Streamable HTTP**
  transport, mounted as a Next.js route handler (`/api/mcp` in `apps/web`) —
  same deploy unit as the site, no extra infra. stdio is for local dev only.
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` (reads `headers()` for
  rate-limit IP — same constraints as ADR-0017).
- The admin already runs `@payloadcms/plugin-mcp` (private, key-gated, for
  Cursor/ops). **Never merge the two**: the public OTA MCP exposes read +
  quote capabilities only; the Payload MCP exposes CMS mutations. Different
  audiences, different auth, different servers.

### Tool design (agent UX)

- Tool names: `verb_noun`, snake_case, stable forever (agents cache them).
- Descriptions are **prompt engineering**: state what the tool returns, its
  units, its limits, and when NOT to use it. Include one example call.
- Inputs flat and primitive (`destination`, `check_in`, `check_out`,
  `adults`) — no nested objects an LLM must guess.
- Outputs: compact JSON with `canonicalUrl` on every entity (the agent must
  be able to cite/link the human page — GEO conversion loop), prices always
  with `currency`, dates ISO 8601.
- Errors: structured (`{ error: { code, message, retryable } }`), never bare
  500 — agents retry on ambiguity and burn rate limit.
- Pagination: `limit` (default 5, max 10) + `nextCursor`. An agent context
  window is the scarcest resource — never dump 50 hotels.
- Expose read-only reference data as MCP **resources**
  (`agent-skills.json`, `llms.txt`, top destinations) rather than tools.

### Auth, rate limiting, abuse

- Anonymous read access mirrors the public site (catalogue is public), but
  **every call goes through `gateAgentByIp`** (Upstash sliding window,
  `apps/web/src/server/agent/rate-limit.ts`) — same budget as ADR-0017
  (60 req/min/IP).
- `request_quote` (writes a `booking_requests_email` row) inherits the
  idempotency Redis 24h + `guest_email` rate limit from
  `submitEmailBookingRequest` for free — never reimplement.
- Optional API keys (partner agents, higher limits): `Authorization: Bearer`,
  keys in Supabase with RLS, never logged. No PII in logs
  (`security-engineering` §PII) — log tool name, duration, hotel slug, never
  guest emails.
- Quote tool must echo back a confirmation summary in its result so the
  calling agent can show the human what was submitted (trust signal).

### Sync contract with GEO surfaces

Any tool added/renamed/removed requires, in the same PR:

1. `packages/seo/src/agent-skills.ts` updated (skill mirror + `endpoint`).
2. `llms.txt` strategy block updated (rule `40-llms-txt-strategy.mdc`).
3. ADR if the surface shape changes (follow ADR-0017 format).

### Testing & validation

- Contract tests in Vitest: call each tool handler with valid/invalid input,
  snapshot the JSON shape (`test-strategy` patterns).
- Manual smoke: MCP Inspector (`npx @modelcontextprotocol/inspector`) against
  local + preview URL before merge; verify tool list, one happy-path call per
  tool, one rate-limited call.
- E2E acceptance: add the server to a real client (Cursor `mcp.json`,
  Claude) and run a realistic booking conversation
  (`user-acceptance-loop` applies to agent surfaces too).
- Monitor in Sentry with a `mcp.tool` tag per call
  (`observability-monitoring`).

## Anti-patterns to refuse

- Business logic implemented inside MCP handlers (must live in domain layer).
- A second Zod schema diverging from the HTTP route schema.
- Unbounded list outputs or full hotel objects with 50 photo URLs.
- Exposing Payload CMS mutations on the public MCP server.
- Tool descriptions like "Searches hotels" (useless to an agent).
- Skipping `gateAgentByIp` because "MCP clients are friendly".

## References

- ADR-0017 `docs/adr/0017-agent-actionable-endpoints.md` — the HTTP surface
  this server wraps; explicitly planned MCP as phase 2026 H2.
- [`api-integration`](../api-integration/SKILL.md) — Zod validation, retries,
  error envelope conventions.
- [`geo-llm-optimization`](../geo-llm-optimization/SKILL.md) —
  `agent-skills.json`, llms.txt, AEO strategy the MCP server executes.
- [`security-engineering`](../security-engineering/SKILL.md) — rate limiting,
  secrets, PII logging rules.
- [`redis-caching`](../redis-caching/SKILL.md) — offer cache, idempotency.
- [`test-strategy`](../test-strategy/SKILL.md) — contract test patterns.
- [`observability-monitoring`](../observability-monitoring/SKILL.md) — Sentry
  tagging.
- [`backoffice-cms`](../backoffice-cms/SKILL.md) — the private Payload MCP
  plugin (kept separate).
