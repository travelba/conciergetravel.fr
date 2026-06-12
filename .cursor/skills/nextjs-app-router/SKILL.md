---
name: nextjs-app-router
description: Next.js 16 App Router patterns and conventions for MyConciergeHotel.com. Use whenever you create or modify routes, layouts, server actions, route handlers, metadata, fetch caching, revalidation tags, or middleware.
---

# Next.js 16 App Router — MyConciergeHotel.com

We use **Next.js 16 App Router** (Turbopack) with **React 19 Server Components by default**. Every change must respect the contractual rendering matrix (cf. `product-architecture` skill).

## Triggers

Invoke when:

- Creating any `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `opengraph-image.tsx`.
- Writing a Server Action.
- Tweaking caching behavior (`fetch` options, `revalidateTag`, `revalidatePath`, `unstable_cache`).
- Touching `middleware.ts` or `next.config.ts`.

## Non-negotiable rules

### Server Components by default

- No `'use client'` unless interactivity, browser API, or hooks are required.
- Heavy editorial pages (hubs, fiches, guides) must be RSC and stream where possible.
- **Interactive UI that only needs hover/focus disclosure (dropdowns,
  tooltips, simple menus) stays Server-Component-only via CSS
  `group-hover` + `group-focus-within`** — adding `'use client'` to the
  site header would silently force every page underneath to leave ISR
  (the auth client island pattern of ADR-0007 collapses). Pattern in
  [`responsive-ui-architecture`](../responsive-ui-architecture/SKILL.md)
  §CSS-only dropdowns keep the header as a Server Component. Only escape to a Client Component for typeahead, full APG
  menubar with roving tabindex, or open-state-survives-outside-click.

### Caching directives

- Marketing/editorial pages: `export const revalidate = N` matching the matrix (24h pillar/editorial, 12h hubs, 6h hotel pages).
- Booking tunnel + search results: `export const dynamic = 'force-dynamic'` and **no fetch caching**.
- API route handlers calling Amadeus availabilities: respect Redis 3-level cache (cf. `redis-caching` skill).
- Use `revalidateTag('hotel:<slug>')`, `revalidateTag('editorial:<slug>')`, `revalidateTag('hub:<region>')` from Payload `afterChange` hooks. **No raw `revalidatePath` from CMS** — tags only, scoped.

### `unstable_cache` return values MUST be JSON-serialisable

Next.js serialises every `unstable_cache` return value through
`JSON.stringify` before persisting it (Vercel data cache, on-disk in
local builds). Non-JSON-native types **silently round-trip to garbage**
on every cache hit after the first in-memory miss:

| Type returned                            | What the consumer receives on cache hit |
| ---------------------------------------- | --------------------------------------- |
| `Map<K, V>`                              | `{}` (plain empty object)               |
| `Set<T>`                                 | `{}`                                    |
| `Date`                                   | ISO string                              |
| `URL`                                    | `{}` with `href` lost                   |
| `BigInt`, `RegExp`, `Function`, `Symbol` | throws or `{}`                          |
| `undefined` inside an object             | the property is dropped                 |
| `class` instance with methods            | plain object, methods gone              |

The failure is **invisible in dev** (cache miss every request) and on
the **first request after deploy** (cache miss populates from the live
function). It surfaces only on the second request to the same cache
key, often hours later on a different locale or a warm lambda — a
classic "works on my machine, 500s in prod" trap.

```ts
// ❌ Bad — works once, then crashes every subsequent request with
//   `TypeError: x.get is not a function`
async function fetchGuides(): Promise<ReadonlyMap<string, string>> {
  const rows = await supabase.from('editorial_guides').select(...);
  const out = new Map<string, string>();
  for (const r of rows.data ?? []) out.set(r.country_code, r.slug);
  return out;
}
export const cachedGuides = unstable_cache(fetchGuides, ['guides-v1'], { revalidate: 3600 });

// ✅ Good — plain Record survives JSON round-trip
async function fetchGuides(): Promise<Readonly<Record<string, string>>> {
  const rows = await supabase.from('editorial_guides').select(...);
  const out: Record<string, string> = {};
  for (const r of rows.data ?? []) {
    if (!(r.country_code in out)) out[r.country_code] = r.slug;
  }
  return out;
}
export const cachedGuides = unstable_cache(fetchGuides, ['guides-v1'], { revalidate: 3600 });
```

**Rules of thumb:**

1. **Return shape = JSON tree.** `Array<T>` or `Record<string, T>` keyed by primitives, with `T` itself JSON-safe. No `Map`, no `Set`, no `Date` (use ISO strings), no class instances. Type the return as `Readonly<Record<string, T>>` so consumers can't reach for `.get()`/`.set()` by reflex.
2. **Convert at the boundary, not inside the cache.** If a downstream call site genuinely wants a `Map`, build it from the cached `Record` in the consumer (`new Map(Object.entries(cached))`). Keep the cache payload boring.
3. **Bump the cache key when the return shape changes.** Vercel's persistent backend serves the old shape to the new code path until the key versions diverge. `['guides-v1']` → `['guides-v2']`. A redeploy alone is **not** enough.
4. **Trace one production cache hit when you ship a new cached function.** A successful preview build only proves the cache miss path. The cache hit path needs at minimum one log line (`console.debug` on cache hydration, or a Sentry breadcrumb) so a future agent can see "this is the hit, not the miss" when debugging.

Cross-ref: see also [`redis-caching/SKILL.md`](../redis-caching/SKILL.md) §Serialization — Upstash Redis SDK has the same JSON-only constraint for the same reason.

### JSON-LD pages MUST be `force-dynamic` (CSP nonce contract)

Any page emitting `<JsonLdScript>` (= every editorial, hotel, hub, home,
guide, classement, marque, categorie page) MUST be `force-dynamic`,
because the script's CSP nonce is per-request:

```ts
export const dynamic = 'force-dynamic'; // CSP nonce + Supabase admin fetches.
```

Re-introducing `revalidate = N` on such a page silently caches HTML
with `nonce=""` — the browser then refuses to execute the JSON-LD and
Google sees zero structured data. This regression was paid twice
(PR #56 hotel detail, PR #57 home). Reference:
`apps/web/src/components/seo/json-ld.tsx` (doc block) and
`structured-data-schema-org` §CSP-nonce-contract.

The Vercel CDN edge cache still mitigates the cost of `force-dynamic`
for editorial routes whose underlying data only changes on publish.

### Metadata

- Every page must export `generateMetadata` (or static `metadata`) producing: `title`, `description`, `alternates.canonical`, `alternates.languages` (FR/EN hreflang), `openGraph`, `twitter`, `robots`.
- Robots rules: marketing/editorial = `index,follow`; booking tunnel/account = `noindex,nofollow`.

### Server Actions

- Wrap with **Zod validation** at the entry. No untrusted client input passes without parse.
- Return discriminated unions: `{ ok: true; data } | { ok: false; error }`. No throws.
- Never call vendor APIs (Amadeus, Brevo, etc.) directly: go through `packages/integrations`.

### Internationalization

- `next-intl` middleware mounted in `middleware.ts`. Default locale `fr` without prefix; `en` prefixed.
- All page params include `[locale]`. Read locale via `unstable_setRequestLocale(locale)` at top of each page/layout.
- **Namespace strings are not type-safe.** A typo like `getTranslations({ namespace: 'hotel' })` (instead of `'hotelPage'`) doesn't fail the build — it silently throws `MISSING_MESSAGE: hotel (fr)` at render time, gets swallowed by the error boundary, and the page degrades visually with no compile signal. Treat any `MISSING_MESSAGE` in the prod log as P1.
  - **Discovery rule**: before merging a PR that touches a new server component using `getTranslations`, do `rg "namespace:\s*['\"]<name>['\"]"` and verify `<name>` exists at the **top level** of `apps/web/src/i18n/messages/fr.json` AND `en.json`. The top-level keys in V1 are `common, navigation, homepage, searchPage, header, concierge, consent, footer, legal, priceComparator, destinationPage, hotelPage, roomPage, errors, account, reservationStart, reservationConfirmation, reservationInvite, reservationRecap, reservationPayment` — anything outside that list is a bug.
  - **Smoke contract**: every E2E that renders an editorial/hotel page must `grep`/`expect-not` `MISSING_MESSAGE` in `console.error`. Otherwise i18n drift accumulates silently across releases.

- **Namespace nesting fails silently** — a namespace object accidentally placed **inside** another top-level namespace (e.g. `header.concierge: { ... }` instead of `concierge: { ... }`) is the same failure mode as a typo: `getTranslations({ namespace: 'concierge' })` returns raw keys (`concierge.metaTitle`), and any downstream `t.raw('faq.items').map(...)` crashes at render with a server 500. Production paid this on **PR #71 → hotfix PR #72** (`/le-concierge` 500 ~20 min after the deploy because `concierge` was nested under `header` in both `fr.json` and `en.json`).
  - **Why CI didn't catch it**: namespace resolution is runtime-only; `next build` never rendered the page because `/le-concierge` is `force-dynamic`; no E2E hit the route; Prettier and ESLint are JSON-shape agnostic.
  - **Visible symptom on the rendered HTML**: `<title>concierge.metaTitle …</title>`, `<meta name="description" content="concierge.metaDesc">`. If you ever see a raw key shape (`<word>.<word>` with a dot, no whitespace) inside a `<title>` or `<meta>` in prod, the namespace lookup failed silently — go check the JSON structure first.
  - **Discovery rule (extended)**: when adding a new `getTranslations({ namespace: 'X' })`, the `rg` check above must verify `X` is **directly** under the JSON root (`{ "X": { ... } }` at the file's top level), not nested. The exact node command we used to debug PR #72 — keep it in your toolbelt:

    ```powershell
    node -e "const j=require('./apps/web/src/i18n/messages/fr.json'); console.log('top-level:', !!j.X); console.log('nested under header?', !!j.header?.X);"
    ```

  - **Test contract going forward**: any new page exporting `force-dynamic` (i.e. invisible to `next build`) MUST be added to `apps/web/e2e/smoke.spec.ts` "new landings" group with an assertion that the rendered `<title>` does **not** match `/<word>\.<word>/` (raw-namespace shape). See [`apps/web/e2e/smoke.spec.ts`](../../../apps/web/e2e/smoke.spec.ts) §`/le-concierge does not leak raw namespace keys`.

### Streaming, suspense, parallel routes

- Wrap independent data fetches in `<Suspense>` with skeleton fallbacks.
- Use parallel routes (`@modal`, `@side`) for booking confirmation modals or hotel galleries when it improves UX.

## File conventions

- Route segment groups: `(marketing)`, `(booking)`, `(account)`. Groups don't impact URL but isolate layouts.
- `loading.tsx` mandatory for any segment that does I/O.
- `error.tsx` mandatory for any user-facing segment with potential vendor errors.
- `not-found.tsx` per segment, surfaces `<NotFoundEditorial />` from `packages/ui`.

## Anti-patterns to refuse

- Using `getServerSideProps` (Pages Router) — we are **App Router only**.
- Sprinkling `'use client'` to "make it work".
- Calling `fetch(...)` with `next: { revalidate: 0 }` on a marketing page (breaks ISR).
- Side effects (mutations) inside Server Components — only Server Actions or route handlers can mutate.
- Leaking secrets to client by reading `process.env.SECRET` inside a client component.
- Bypassing `next-intl` to hardcode FR strings in JSX.

### Naming collision with a route segment param → Turbopack minifier bug

**Forbidden pattern** in any `app/[locale]/<...>/page.tsx` Server Component:

```ts
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale: Locale = raw; // ❌ local var named after the segment

  return helperThatTakesLocale({
    locale, // ❌ shorthand triggers the minifier bug
    freshnessDate,
  });
}
```

What goes wrong: Turbopack's production minifier (Next 15) **silently
fails** to rewrite the shorthand `locale,` inside the inlined object
literal when the local variable's name collides with the destructured
property name from the route segment (`{ locale: raw }`). At runtime
this produces:

```
ReferenceError: locale is not defined
```

— but **only** in the production bundle. `next dev` (no minifier) and
`tsc --noEmit` both pass. The bug was diagnosed live (2026-05-27,
commit `0caa396`) by reading the minified chunk in
`.next/server/chunks/ssr/apps_web_src_app_[locale]_marque_[brandSlug]_page_tsx_*.js`:

```js
// what Turbopack emitted (broken):
let{locale:D,brandSlug:E}=await a;     // segment property → D
// ...inlined helper call...
let s={brandLabel:F.label, ..., locale, freshnessDate:O};
                                 ^^^^^^
//                              should be `locale:D`, isn't
```

**Required pattern**: rename the local to `activeLocale` (or anything
that doesn't collide with the segment property name) AND prefer
explicit object properties over shorthand whenever the property name
matches a destructured segment param:

```ts
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const activeLocale: Locale = raw; // ✅ no collision

  return helperThatTakesLocale({
    locale: activeLocale, // ✅ explicit, not shorthand
    freshnessDate,
  });
}
```

**Debugging recipe** when a `ReferenceError` appears in prod but not in
dev:

1. Build locally with `pnpm --filter @mch/web build`.
2. Start prod server: `cd apps/web && npx next start --port 3001`.
3. `curl -sS http://localhost:3001/<failing-path>` to confirm reproduction.
4. `ls apps/web/.next/server/chunks/ssr/<route>*page_tsx_*.js` to find
   the minified chunk for the route segment.
5. `Select-String -Pattern 'ReferenceError|<symbol>' -Path <chunk>` or
   read a window around the helper call to inspect the minified
   shorthand expansion.
6. Once you find a `prop,` (shorthand) inside a `let X = { ..., prop, ... }`
   that the minifier should have rewritten to `prop:Y`, rename the
   colliding local and convert the shorthand to explicit.

### Defensive upstream calls in static-prerendered routes

Every `page.tsx` / `route.ts` that runs at build time AND touches an
upstream service (Supabase, Algolia, Cloudinary admin) **must** wrap the
call so an outage degrades to an empty render rather than crashing the
build. Same contract as `generateStaticParams` returning `[]`.

The CI Build job and the first Vercel prerender both run with stub or
unreachable credentials. Without a try/catch, you get this opaque
failure that aborts the entire deploy:

```
Error occurred prerendering page "/llms.txt".
Error: supabaseUrl is required.
Export encountered an error on /llms.txt/route, exiting the build.
```

Pattern (try/catch over `.catch(() => [])` because TypeScript's strict
inference around `readonly T[]` and Promise overloads gets confused
otherwise):

```ts
export const revalidate = 3600;

export default async function ClassementsHubPage(...) {
  // Defensive: degrade to an empty hub when Supabase is unreachable.
  let rankings: readonly PublishedRankingCard[];
  try {
    rankings = await listPublishedRankings();
  } catch {
    rankings = [];
  }
  // ...
}
```

Applies symmetrically to route handlers (`route.ts`):

```ts
const [hotels, rankings] = await Promise.all([
  listPublishedHotelSummaries(50).catch(() => []),
  listPublishedRankings().catch(() => []),
]);
```

The `Promise.all + .catch(() => [])` form is fine when the consuming
code never re-uses the array in a position that triggers the
`readonly` inference issue. When it does (typically `Array.reduce<T>`
or property access on an inferred element), fall back to try/catch.

### Function props NEVER cross the RSC → Client boundary (Next 15.3+)

A Server Component cannot pass a function (closure, arrow, method) as a
prop to a Client Component. Next 15.3 throws at request time:

```
Error: Functions cannot be passed directly to Client Components unless
you explicitly expose it by marking it with "use server".
{ ..., lightboxCounter: function lightboxCounter }
```

The typical trap is wrapping `next-intl`'s `getTranslations` in a closure:

```tsx
// ❌ Bad — Server Component, closure prop
<HotelGalleryLightbox
  translations={{
    lightboxCounter: (current, total) => t('gallery.lightboxCounter', { current, total }),
  }}
/>
```

Two fixes that DO cross the boundary safely:

```tsx
// ✅ Good — pass the raw ICU template, interpolate in the client
<HotelGalleryLightbox
  translations={{
    lightboxCounterTemplate: t.raw('gallery.lightboxCounter') as string,
  }}
/>;

// Inside the 'use client' component:
const label = props.translations.lightboxCounterTemplate
  .replace('{current}', String(current))
  .replace('{total}', String(total));
```

```tsx
// ✅ Good — use `useTranslations` directly in the client component
'use client';
import { useTranslations } from 'next-intl';
function Lightbox() {
  const t = useTranslations('hotelPage');
  return <p>{t('gallery.lightboxCounter', { current, total })}</p>;
}
```

Reference fix: `apps/web/src/components/hotel/hotel-gallery-lightbox.tsx`
(`lightboxCounterTemplate` prop) — was caught when smoke-testing
`/fr/hotel/le-bristol-paris` after a Next 15.1 → 15.3 upgrade.

### Middleware matcher must list every top-level folder you want to bypass

`next-intl`'s middleware matcher uses a negative-lookahead alternation
to skip non-app routes. Every new top-level folder (`/sitemaps/*.xml`,
`/api/health`, `/.well-known/*`) must appear in the alternation, otherwise
the middleware rewrites it to `/fr/<path>` and the request 404s. Single
files (`sitemap.xml`, `robots.txt`) need their full filename; folders
need only the folder name without extension:

```ts
matcher: [
  '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sitemaps|llms.txt|llms-full.txt|.well-known|manifest.webmanifest|monitoring|logos).*)',
];
```

Symptom of a missing entry: route handler exists, build log lists it as
prerendered (`○ /sitemaps/rankings.xml`), but production returns 404.

**`public/` subfolders are NOT auto-bypassed** — this is the trap to remember.
`/favicon.ico` is special-cased by Next.js but `/og/*`, `/logos/*`,
`/manifest/*` are NOT. If you put a static asset under `public/<folder>/`
you MUST add `<folder>` to the matcher. Worse, the symptom is double:

1. Direct `<img src="/logos/logo.png">` returns 404.
2. `<Image src="/logos/logo.png">` ALSO returns 404 because the
   `/_next/image?url=%2Flogos%2Flogo.png&w=...` lambda fetches the source
   over HTTP internally and that fetch hits the middleware too.

Real example (2026-05-28 — PR #112): committed `apps/web/public/logos/
logo-dark.png` + `<Image src="/logos/logo-dark.png">`, shipped via PR,
PO landed on `/dev/logo-preview` and saw 8 broken-image icons. Root
cause: `logos` was missing from the matcher above. Fix = add `logos`
and force a redeploy.

**Rule of thumb when adding to `public/`**: if it's not a top-level
single file already in the matcher (`robots.txt`, `sitemap.xml`,
`favicon.ico`, `manifest.webmanifest`), then either (a) put it under
an already-bypassed folder, (b) add the new folder to the matcher, or
(c) keep it as an `app/` route handler that returns the binary.

## Example: marketing page with ISR + JSON-LD + AEO

```tsx
// apps/web/src/app/[locale]/(marketing)/hotels/france/[region]/[city]/[hotel]/page.tsx
import { unstable_setRequestLocale } from 'next-intl/server';
import { getHotelBySlug } from '@/lib/data/hotels';
import { JsonLd } from '@mch/seo/jsonld';
import { hotelJsonLd, breadcrumbJsonLd } from '@mch/seo/jsonld/builders';
import { AeoBlock } from '@mch/ui/seo/AeoBlock';

export const revalidate = 21600; // 6h ISR per CDC §2.2

export async function generateMetadata({ params }) {
  /* ... */
}

export default async function HotelPage({ params: { locale, region, city, hotel } }) {
  unstable_setRequestLocale(locale);
  const data = await getHotelBySlug({ slug: hotel, locale });
  if (!data) notFound();

  return (
    <>
      <JsonLd schema={hotelJsonLd(data)} />
      <JsonLd schema={breadcrumbJsonLd(data.breadcrumbs)} />
      <AeoBlock>{data.aeoAnswer}</AeoBlock>
      <HotelDetail hotel={data} />
    </>
  );
}
```

## Private folders — `_foldername` is **not** a route

Next.js App Router treats any folder prefixed with `_` as **private** —
files inside are excluded from routing entirely, even if they export a
valid `page.tsx` / `route.ts`. This is documented but easy to forget
mid-debugging.

Concrete bite (18 May 2026, lost ~20 min during a Vercel preview
investigation): a diagnostic route at
`apps/web/src/app/api/_diag/supabase/route.ts` returned a 404 page
from every URL we tried. Vercel build logs showed nothing about the
file. The fix was a single rename — `_diag` → `diag` — and the route
appeared at `/api/diag/supabase` on the next deploy.

Use cases — when to keep / avoid the underscore prefix:

- **Keep `_`** for collocated helpers (`_components/`, `_lib/`,
  `_types.ts`) that should live next to their consumers but never be
  routed. This is the intended use of private folders.
- **Avoid `_`** for any folder that hosts a `page.tsx`, `route.ts`,
  `layout.tsx`, or `loading.tsx`. Use a different naming convention
  if you want to mark the route as internal (e.g. `/api/diag/`,
  `/admin/`, or route groups with `(group)`).
- **Token-gate** internal routes (diagnostic, admin tooling) via a
  hard-coded UUID or a dedicated env secret — don't rely on obscurity.

## References

- Next.js 15 App Router docs — [Private folders](https://nextjs.org/docs/app/building-your-application/routing/colocation#private-folders).
- CDC v3.0 §2.2 (rendering), §6 (SEO/GEO), §9 (mobile-first).
- `seo-technical`, `redis-caching`, `responsive-ui-architecture` skills.
- **`structured-data-schema-org`** — CSP nonce contract details for JSON-LD.
- **`security-engineering`** — full CSP3 policy + middleware.
- **`editorial-long-read-rendering`** — two-column layout, TOC sidebar pattern.
- **`cicd-release-management` Rule 9** — Vercel env vars scoped per
  environment (Production / Preview / Development); the cross-link for the
  diagnostic-endpoint pattern that triggered this skill update.
