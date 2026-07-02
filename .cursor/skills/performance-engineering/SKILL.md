---
name: performance-engineering
description: Performance engineering rules for MyConciergeHotel.com (Core Web Vitals, image optimization, fonts, code splitting, edge runtime). Use when you ship UI, add dependencies, or change build/runtime configuration.
---

# Performance engineering — MyConciergeHotel.com

The cahier des charges sets **contractual Core Web Vitals targets** (CDC v3.0 §9.2):

| Metric                          | Target                                        |
| ------------------------------- | --------------------------------------------- |
| LCP (Largest Contentful Paint)  | **< 2.0 s** mobile 4G                         |
| CLS (Cumulative Layout Shift)   | **< 0.05** all pages                          |
| INP (Interaction to Next Paint) | **< 200 ms** mobile                           |
| TTFB (Time to First Byte)       | **< 600 ms** Vercel Edge                      |
| PageSpeed Insights              | **> 90 mobile / > 95 desktop** on hotel pages |

These targets are validated in CI via Lighthouse CI on 5 strategic pages: homepage, regional hub, hotel detail, classement, booking tunnel.

## Triggers

Invoke when:

- Adding any new dependency (audit bundle impact).
- Adding fonts, images, or media.
- Touching `next.config.ts`, image config, runtime config.
- Building a heavy component (gallery, map, carousel).
- Suspecting a regression on Core Web Vitals.

## Non-negotiable rules

### Images

- **Always** Next.js `<Image>` with explicit `width` and `height` (or `fill` + sized parent) to prevent CLS.
- Above-the-fold hero on hotel page uses `priority` and AVIF/WebP via `next.config.ts` `images.formats`.
- Cloudinary URLs go through `loaderFile` in `next.config.ts`; serve `f_auto,q_auto` and responsive widths.
- Lazy-load galleries with `loading="lazy"` and `decoding="async"` (default on `<Image>`).

### Fonts

- `next/font/google` with `display: 'swap'` and `subsets: ['latin']` for serif title font and sans body font.
- Preload only the body font; serif title font is fine non-preloaded.
- No FOIT, no FOUT — `swap` strategy.

### JavaScript

- Server Components by default; only interactive widgets are `'use client'`.
- Lazy-load heavy client islands with `next/dynamic` and `ssr: false` only when truly client-only (e.g. Amadeus Payment iframe wrapper).
- Bundle audit on PR: `pnpm dlx @next/bundle-analyzer` script wired in.
- No CommonJS-only deps if an ESM alternative exists.

### Caching

- Marketing/editorial: ISR per matrix (24h pillar/editorial, 12h hubs, 6h hotel) with `revalidateTag` for granular invalidation.
- API routes for ARI: 3-level Redis cache (cf. `redis-caching`).
- HTTP cache headers on dynamic OG images: `Cache-Control: public, max-age=31536000, immutable`.

### Streaming

- Wrap independent server fetches in `<Suspense>` so initial paint doesn't wait on Amadeus.
- Skeletons must reserve exact pixel space (no CLS).

### Client-island placeholder height mismatch (sitewide CLS) — 2026-06-22

A client island whose loading placeholder is **shorter than its resolved
content** causes CLS the moment it hydrates. Reference case: `auth-area.tsx`
(`variant="header"`) reserved an `h-9` (36px) placeholder, but the resolved
signed-out CTAs (`Connexion` + `Créer un compte`) had **no `whitespace-nowrap`
/ `shrink-0`**, so the shared header flex row (`nav` is `flex-1`) shrank the
`Créer un compte` button to its widest-word width → the text **wrapped to 3
lines (72px)**. That 36px under-reservation grew the `SiteHeader` 84→105px on
every signed-out desktop inner page (home uses a different kit header) → CLS
**~0.95**. EN was spared (`Sign up` wraps to only 2 lines = 52px, ~0 CLS).

Lessons:

- **The header height is driven by its tallest child** (here the 51px nav).
  CLS magnitude = how much a hydrating island _exceeds_ that tallest stable
  child. Keep every header island **≤ the nav height in both placeholder and
  resolved states** and the row height never moves. Fix was just
  `whitespace-nowrap` on the CTAs + `shrink-0` on their container (CSS-only, no
  JS, zero LCP/TBT impact).
- **Diagnose SSR-vs-hydrated layout with two Playwright contexts**, not timing
  games: load once with `javaScriptEnabled: false` (pure SSR DOM + webfonts),
  once with JS on, and diff the suspect element's `getBoundingClientRect()`
  height. The delta is the exact CLS source. A `PerformanceObserver('layout-shift')`
  trace + a per-child height timeline pinpoints _which_ child grows.
- A loading placeholder's job is to match the **resolved** height, but if the
  resolved height is itself a wrapping/shrink bug, fix the wrap (restores the
  intended single-row design the `h-9` placeholder already encoded) rather than
  inflating the placeholder to a fragile, viewport-dependent tall value.

### Third-party scripts

- Loaded with `next/script` `strategy="afterInteractive"` (analytics) or `strategy="lazyOnload"` (non-critical).
- Sentry: client SDK loaded with care (replay disabled by default; tunneled via `/monitoring/sentry-tunnel`).

### Edge runtime

- Use `export const runtime = 'edge'` for lightweight route handlers (auth callbacks, robots, llms.txt) — but NOT for handlers calling Supabase Auth admin or Sentry server SDK.

### Server-render CPU: text-processing components scale with corpus × content

Case study (2026-07-02, ADR-0031 §Bonus finding): `/destination/paris` held a
constant **21 s TTFB** with all data caches warm. Root cause was not I/O but
`<EnrichedText>` (the editorial auto-linker): it compiled the full ~5 000-entry
link map into Unicode lookbehind regexes **per component render** (one render
per guide section) and ran **every** regex against **every** paragraph —
O(entries × paragraphs) `.exec` scans, tens of seconds of pure CPU per request.
The fix cut it to 3.2 s without touching rendering mode:

1. **Cache the compiled corpus by input identity** — a
   `WeakMap<EditorialLinkMap, CompiledEntry[]>` gives one compilation per page
   render (the page builds one Map shared by all sections) and frees with the
   request.
2. **Lazy-build expensive artefacts** — the regex per entry is only constructed
   the first time the entry survives the pre-filter.
3. **Pre-filter with a cheap operation** — `paragraphLower.includes(entry.lower)`
   rejects ~99 % of the corpus before any regex work. A case-insensitive regex
   can only match when the lowercased needle occurs as a substring.

Rule: any server component that scans a large dictionary against long-form
content (auto-linkers, glossaries, leak gates rendered inline) must be
profiled with a warm data cache — if warm TTFB doesn't drop, the cost is CPU,
and the levers above apply. `scripts/perf/ttfb-probe.mjs` separates TTFB from
download time for exactly this diagnosis.

### `unstable_cache` write failures are SILENT — verify every new cache

Case study (2026-07-02, same session): the catalogue scan in
`server/destinations/cities.ts` was wrapped in `unstable_cache` with
descriptions capped to shrink the payload… and the warm TTFB did not move
(home / hub / destination stuck at 2.5-5 s). The entry serialised to
**3.07 MB > the 2 MB per-entry Data Cache limit**: every write failed, the
function result was still returned, and the only signal was a server-log
line — `Failed to set Next.js data cache …, items over 2MB can not be
cached`. Nothing throws, nothing surfaces in the response.

Fix pattern: **shard the cache key** so each entry stays under 2 MB — here,
one `unstable_cache` entry per 1000-row page (`unstable_cache` folds the
`page` argument into the key), reassembled by a thin uncached loop. Result:
home 2 550 ms → 114 ms, `/destination/paris` → 113 ms.

Mandatory verification for ANY new `unstable_cache` around a catalogue-scale
payload:

1. Hit the route twice and check the server log for the `items over 2MB`
   warning (local `next start` enforces the same limit as Vercel).
2. Confirm the warm TTFB actually dropped (`scripts/perf/ttfb-probe.mjs`).
3. Pair with the throw-on-error contract (raw fetch throws, outer wrapper
   catches → `[]`) so a transient outage is never persisted for a full TTL.

## Anti-patterns to refuse

- `<img>` without dimensions.
- Importing a date/i18n library that adds 200kb of locales (use date-fns selective imports or Intl native).
- Loading Google Tag Manager or analytics on the booking tunnel.
- Flipping an HTML route to `force-static` / `revalidate` to "fix" TTFB — under the per-request-nonce CSP this ships unhydratable HTML (every script blocked; ADR-0031). All HTML routes stay dynamic; optimise the data layer + render CPU instead.
- `'use client'` on entire pages because of one interactive button.
- Inline styles built dynamically from props (CSS-in-JS at runtime) on hot paths — use Tailwind classes / static CSS.
- A client-island loading placeholder shorter than its resolved content (header/auth/locale islands) — match heights or keep the island ≤ the row's tallest stable child (see §Client-island placeholder height mismatch).

## CI gates

- `pnpm typecheck` and `pnpm lint` block PRs.
- Lighthouse CI on 5 strategic URLs blocks PR if any target fails.
- Bundle size budget per route in `apps/web/next.config.ts`.

## References

- CDC v3.0 §9.1, §9.2.
- web.dev Core Web Vitals.
- `nextjs-app-router`, `redis-caching`, `responsive-ui-architecture` skills.
