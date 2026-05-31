---
name: api-integration
description: Standard pattern for vendor API integrations in MyConciergeHotel.com (HTTP client, retries, timeouts, schema validation, errors, logging, caching). Use whenever you implement or modify any third-party API integration in `packages/integrations/`.
---

# API integration pattern — MyConciergeHotel.com

Every vendor (Amadeus, Little Hotelier, Makcorps, Apify, Google Places, Brevo, Algolia, Sentry tunnel) is encapsulated in a dedicated package under `packages/integrations/<vendor>/`. The pattern is uniform.

## Triggers

Invoke when:

- Adding a new integration package.
- Modifying retry / timeout / error mapping behavior.
- Editing the public surface of an integration (functions consumed by `apps/web` / `apps/admin`).

## Standard layout

```
packages/integrations/<vendor>/
├── client.ts          # configured fetch/SDK instance + auth
├── types.ts           # Zod schemas + inferred types
├── errors.ts          # typed error class hierarchy
├── cache-keys.ts      # Redis key builders (if cached)
├── <resource>.ts      # one file per resource (hotels.ts, offers.ts, orders.ts, ...)
├── index.ts           # public re-exports
└── package.json
```

## Non-negotiable rules

### Authentication

- Secrets read **only** from validated env via `packages/config/env`.
- OAuth2 client credentials (Amadeus): cache the access token in Redis with TTL = `expires_in - 60s`. Refresh on 401.
- Never log tokens, full headers, or PII.

### HTTP client

- Use the global `fetch` (Edge-compatible). Optional `undici` `Agent` only on Node-only paths.
- **Mandatory wrapper** `httpRequest({ url, method, body, headers, timeoutMs, retry })`:
  - `AbortController` with default timeout 8s (override per resource).
  - Retries: 3 attempts max, exponential backoff (200ms × 2^n + jitter), only on `429`, `502`, `503`, `504`, network errors.
  - Idempotency: GET/HEAD always retried; POST/PUT/DELETE retried only when an `Idempotency-Key` is set.
  - Rate-limit aware: respect `Retry-After` if present.

### Validation

- Every response is parsed by a Zod schema. No raw JSON returned to callers.
- If Zod fails: log Sentry `extra` with vendor + operation + input shape (no PII), return `Result.err({ kind: 'parse_failure' })`.

### Errors

- Typed hierarchy:
  ```ts
  type AmadeusError =
    | { kind: 'auth_failed' }
    | { kind: 'rate_limited'; retryAfterSec: number }
    | { kind: 'not_found' }
    | { kind: 'parse_failure'; details: string }
    | { kind: 'upstream_5xx'; status: number }
    | { kind: 'timeout' }
    | { kind: 'network' };
  ```
- Functions return `Result<T, VendorError>`; never throw to callers.

### Logging

- Sentry breadcrumb on every outbound call: `category: 'http'`, `data: { vendor, operation, status, durationMs }`.
- Sample 100% of errors, 10% of successful calls in production.

### Caching

- Read-through cache helper `withRedisCache({ key, ttlSec, fetcher })` (see `redis-caching` skill).
- Never cache responses containing card data or payment intents.

### Public surface

- Export functions only, no classes. Keep it tree-shakeable.
- Inputs validated with Zod at the boundary, not just typed.
- Stable function names: `searchHotels`, `getHotelOffers`, `getOfferById`, `createOrder`, etc.

### Tests

- Vitest unit tests with MSW or `fetch-mock` to simulate vendor responses (success, 429, 5xx, malformed).
- One e2e Playwright run against Amadeus test environment in CI nightly job.

## Anti-patterns to refuse

- Direct `fetch` calls inside route handlers or Server Components.
- Returning raw vendor JSON to UI.
- Manual `setTimeout` retry loops without jitter.
- Swallowing errors with `try { ... } catch {}`.
- Hard-coded URLs instead of env-driven base URLs.
- Mixing two vendors in one file.

## Vendor-specific gotchas captured from production

### Wikimedia Commons (no-auth, public API)

- **User-Agent header is mandatory** (MediaWiki policy). Use a string
  identifying the project + a contact URL:
  ```
  MyConciergeHotelBot/0.1 (https://myconciergehotel.com; tech@myconciergehotel.com) MediaWiki-Action-API
  ```
  Omitting it returns 403 sporadically and gets the IP banned after ~30 req.
- **Two-step photo fetch**: `list=categorymembers` returns titles, then
  `prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600` batches
  up to **50 titles per call** via the `|` separator. Don't make 1 call
  per title.
- **Category prefix normalisation**: Wikidata persists categories WITHOUT
  the `Category:` prefix; MediaWiki `cmtitle` requires it. Helper:
  ```ts
  buildCmTitle('Le Bristol Paris'); // → 'Category:Le_Bristol_Paris'
  ```
- **Filter by MIME**: a "Hôtel X" category can contain a sound clip of
  the jingle (`audio/ogg`), architectural plans (`image/svg+xml`), or
  scanned historical postcards. Keep only:
  `image/jpeg | png | webp | avif | heic | heif`. The skill ships
  `ALLOWED_IMAGE_MIMES` in `wikimedia-commons/types.ts`.
- **License is mandatory**: drop entries where
  `extmetadata.LicenseShortName.value` is missing (Wikimedia legacy
  uploads sometimes have it null). All published photos must carry an
  attribution we can reproduce server-side.
- **Attribution often contains HTML** (`<a href="...">User:Foo</a>`).
  Strip it before pushing to Cloudinary `context.alt`:
  ```ts
  attribution
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  ```
- **Pagination via `continue.cmcontinue`**: walk it until `maxN`
  collected OR exhausted. Don't trust a single 50-item page.
- **`formatversion=2` + `origin=*`**: the v2 format always returns
  `pages` as an array (v1 returns a `Record<pageId, page>`, painful
  to iterate). `origin=*` keeps CORS happy if you ever run from the
  browser.

### Google Places (New) v1

- **New API ≠ legacy API**. The new endpoints are
  `places.googleapis.com/v1/*` and use a **FieldMask header**
  (`X-Goog-FieldMask`) to narrow the response. The legacy Places API
  is on a different host and price scheme.
- **FieldMask is mandatory** for `searchText`. Without it the call
  returns `INVALID_ARGUMENT`. Always specify
  `places.id,places.displayName,places.photos` to avoid wide responses.
- **Photo URI resolution**: `GET /v1/{photo.name}/media` with
  `skipHttpRedirect=true` → returns JSON `{ photoUri }`. Without
  `skipHttpRedirect`, Google 302-redirects to a CDN URL that requires
  preserving headers; awkward in a Cloudinary upload pipeline.
- **Cost (May 2026)**: Text Search = $32/1k, Place Photos = $7/1k.
  Plan ~$10 for a 100-hotel batch (10 photos / hotel). Well within
  the $200 monthly Maps credit.
- **Match heuristic**: Text Search returns restaurants, viewpoints or
  landmarks named after the hotel. Filter by a tokenised overlap on
  the hotel name (drop tokens like "hotel"/"hôtel" — they appear
  everywhere). The skill ships `looksLikeMatch` in `google-places/client.ts`.
- **Attribution**: Google ToS requires displaying `authorAttributions[0].displayName`
  - linking to `authorAttributions[0].uri`. We forward both into the
    Cloudinary `context.alt` + `tags`.

### Cloudinary Node SDK

- **The SDK keeps config in a module-level singleton** (`cloudinary.config(...)`).
  Calling it twice with different cloud names within the same process
  **does not** work — the second call wins for every subsequent op.
  Fine for a single-cloud orchestrator, but tests must reset between
  cases.
- **`upload(sourceUrl, ...)`** is idempotent if you pass `overwrite: true`
  and a stable `public_id`. We use `{source}-{index}` (e.g.
  `commons-1`, `places-3`) so re-runs after a partial failure don't
  spawn duplicates.
- **Folder convention**: `cct/hotels/{slug}/`. Cap to that prefix
  enables a future `cloudinary.api.delete_resources_by_prefix(...)`
  for cleanup.
- **Context syntax**: `key=value|key=value|...`. The values **must**
  have `|` and `=` stripped first or the SDK silently truncates.
- **Tags must match `^[A-Za-z0-9_-]+$`**: slugify before passing.
- **Default `transformation: [{ width: 2400, height: 2400, crop: 'limit', quality: 'auto:best' }]`**
  on inbound upload — Commons originals are sometimes 30-40 MB which
  blows past the 10 MB single-upload cap on free tier. `c_limit`
  preserves aspect ratio.
- **`format` is detected from the byte stream**. Reject GIF (animated,
  hotels don't benefit) and SVG (vector, irrelevant for photography)
  AFTER upload via the result's `format` field.

### Multi-tier orchestrator pattern (Commons → Places → Cloudinary)

- **Sequential tiers, parallel hotels**. Each hotel does Tier 1 (no
  cost) first; if `tier1.length < maxPerHotel` AND `--tier=all`, then
  Tier 2 fills the gap. Worker pool over hotels gives the speed-up
  without exploding the per-vendor QPS.
- **JSONL runlog** at `scripts/editorial-pilot/out/photos-runlog-{date}.jsonl`.
  Every per-hotel outcome (ok/skip/fail + counts + reason) is appended.
  Resumability + audit trail for free; `jq` or Excel can chart it.
- **Optional vendor keys**: model env loaders so dry-runs work with
  zero vendor secrets configured. `requirePhotoEnv({ needsCloudinary,
needsGooglePlaces })` enforces the right subset only when the
  orchestrator actually intends to call that vendor.
- **MergedPhoto common shape**: when two tiers produce different
  payloads (Commons normalises around `pageId/license`, Places around
  `photoName/authorAttributions`), converge them in the orchestrator
  through a `MergedPhoto = { source, downloadUrl, altFr, tags }` —
  uniform input to the Cloudinary upload step.

## Skeleton

```ts
// packages/integrations/<vendor>/client.ts
import { env } from '@mch/config/env';

export async function httpRequest<T>(opts: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retry?: { attempts: number; backoffMs: number };
}): Promise<Response> {
  /* ... */
}
```

## Gotcha — MSW string paths with a colon swallow sibling RPC endpoints

Google's "New" APIs use colon-suffixed RPC URLs (`…/v1/places:searchText`,
`…/v1/places:searchNearby`). In MSW (path-to-regexp under the hood), a
literal `:` in a **string** matcher is parsed as a **path parameter**, so

```ts
http.post('https://places.test/v1/places:searchText', resolver);
```

actually matches `places:ANYTHING` — including `places:searchNearby`. The
first registered handler silently swallows the second endpoint's requests,
and the symptom is baffling: the call "succeeds" (`res.ok === true`) but
returns the _wrong_ body, so your normaliser drops everything and you get
an empty array with no error (verified 2026-05-31 on the Places POI
fallback — searchNearby got searchText's location-less places → 0 POIs).

Fix: use an **anchored RegExp** matcher for colon-suffixed endpoints so
the URL is matched literally:

```ts
http.post(/\/v1\/places:searchText$/u, resolver);
http.post(/\/v1\/places:searchNearby$/u, resolver);
```

See `packages/integrations/src/google-places/client.test.ts`.

## References

- CDC v3.0 §5 (intégrations externes), §11 (security).
- `redis-caching`, `observability-monitoring`, `security-engineering` skills.
- **`llm-output-robustness`** — required reading when the "vendor" is an
  LLM (OpenAI, Anthropic, etc.): multi-call single-concern pipelines,
  schemas tolerant to LLM drift, allowlist post-validation, retry strategy.
- **`windows-dev-environment`** — Supabase SSL strip, PowerShell quoting
  when invoking integration scripts from the dev shell.
