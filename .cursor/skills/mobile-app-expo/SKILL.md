---
name: mobile-app-expo
description: iOS + Android mobile app for MyConciergeHotel.com — Expo (React Native) in the monorepo as apps/mobile, sharing domain/integrations/tokens with the web. Covers workspace setup, navigation, auth, design-token parity, offline/cache strategy, deep links, EAS builds and store compliance. Use when creating or modifying the mobile app, or when a web change impacts shared packages consumed by mobile.
---

# Mobile app (Expo / React Native) — MyConciergeHotel.com

Target: a native-feeling luxury companion app (search, hotel fiches, booking
requests, Concierge Club) on iOS + Android from **one TypeScript codebase**,
reusing the monorepo's domain layer — not a second product.

## Triggers

Invoke when:

- Scaffolding or modifying `apps/mobile`.
- Changing `packages/{domain,integrations,db}` in ways mobile consumes.
- Working on push notifications, deep links, offline behaviour, store builds.
- Porting a web feature to mobile (parity decisions).

## Non-negotiable rules

### Stack & workspace (decision — record as ADR when scaffolding)

- **Expo SDK (managed workflow) + expo-router + TypeScript strict**, as
  `apps/mobile` in the existing pnpm/Turborepo workspace (ADR-0002 pattern:
  apps never import each other, everything shared goes through `packages/`).
- React Native consumes `packages/domain` (pure TS — works as-is) and
  `packages/integrations` **only via server-safe boundaries**: vendor secrets
  (Amadeus, Brevo) never ship in the app bundle. Mobile calls the same public
  surface as agents — `/api/agent/*` + future MCP-backed endpoints
  (ADR-0017) — or dedicated `/api/mobile/*` BFF routes in `apps/web`.
- Supabase: `@supabase/supabase-js` with the **anon key only** + RLS
  (`supabase-postgres-rls` rules apply unchanged); session storage via
  `expo-secure-store`. Service-role keys are server-only, forever.
- Metro must resolve workspace packages: enable `unstable_enablePackageExports`
  and watch the monorepo root; never `npm pack` or copy-paste shared code.

### Design parity (one brand, two renderers)

- The web's CSS tokens (`packages/ui/tokens.css`) are mirrored as a TS token
  module (`packages/ui/tokens.ts`) consumed by both Tailwind config (web) and
  the RN theme (mobile). One palette, one spacing scale, one type ramp —
  serif display + sans body, same `--color-accent-gold`.
- Touch targets ≥ 44×44pt, mobile-first flows identical to web CDC §9 (max
  3 screens: Search → Tunnel → Confirmation).
- Motion follows `luxury-motion-effects` values: 150/250/400ms, ease-out,
  GPU-only (`react-native-reanimated` worklets on `transform`/`opacity`),
  respect `AccessibilityInfo.isReduceMotionEnabled`.
- Images via `expo-image` with the **same Cloudinary presets** as web
  (ADR-0024 locked transforms) — request the rendition matching the device
  bucket, never original assets; built-in disk cache on.

### Navigation, deep links, SEO bridge

- `expo-router` file-based routes mirroring web URL structure
  (`/hotels/[slug]`, `/destinations/[slug]`) so **universal links / app links
  map 1:1 to canonical web URLs** (ADR-0008 flat hotel URLs). Configure
  `apple-app-site-association` + `assetlinks.json` served by `apps/web`.
- Every share action exports the canonical web URL — the app feeds the
  SEO/GEO loop, never competes with it.
- In-app browser (`expo-web-browser`) for legal pages and payment fallbacks
  rather than re-implementing them.

### Data, offline & performance

- Server state via TanStack Query: offers/availability `staleTime` ≤ 5 min
  (mirror the Redis TTL from ADR-0017 — never cache prices longer on device
  than the server does), hotel fiches cacheable for offline reading.
- Persist the query cache (AsyncStorage persister) for flight-mode reading of
  saved hotels; **never persist offers/prices** beyond their TTL, and never
  any payment data.
- Hermes engine, `expo-image`, FlashList for catalogue lists; no JS scroll
  listeners (Reanimated scroll handlers only).
- Cold start budget: interactive < 2s on mid-range Android; track with
  Sentry React Native (same org/project tagging as `observability-monitoring`).

### Booking & payments

- Phase 1: `request_quote` flow (email booking mode) reusing
  `submitEmailBookingRequest` semantics via the public API — idempotency and
  rate limits inherited, identical to web/agents.
- Native payments (Amadeus iframe / Apple Pay / Google Pay) are a separate,
  ADR-gated phase — Apple/Google **allow external booking payments for real-world
  services** (travel = exempt from IAP), document this in the App Review notes.
- Cancellation policy displayed verbatim before any payment step
  (`payment-orchestration` rule, unchanged).

### Store compliance (blockers if late)

- iOS: privacy manifest (`PrivacyInfo.xcprivacy`), App Tracking Transparency
  only if ads SDKs appear (avoid), sign-in parity (if email login exists,
  Apple Sign-In is mandatory).
- Android: Data Safety form matching actual Supabase/Sentry collection,
  target API level per current Play policy.
- GDPR parity with web: same consent surface, Sentry scrubbing of PII
  (`security-engineering`).
- EAS Build + EAS Submit in CI (`cicd-release-management` patterns); OTA
  updates via EAS Update for JS-only fixes — never ship a store binary for a
  copy change.

### Testing

- Domain logic stays in `packages/domain` → existing Vitest suites cover it.
- Component tests: React Native Testing Library; E2E happy path (search →
  fiche → quote) with Maestro on both platforms before each store release
  (`test-strategy` + `user-acceptance-loop` applied to devices: walk it on a
  real iPhone + one mid-range Android, fr + en).

## Anti-patterns to refuse

- Vendor secrets or service-role keys in the app bundle / Expo config.
- Duplicating domain logic inside `apps/mobile` instead of `packages/`.
- Web-only assumptions in shared packages (`window`, `document`, CSS imports)
  — guard with platform-neutral code.
- Caching prices on-device longer than the server TTL.
- Custom WebView checkout for payments (store rejection risk + 3DS2 break).
- A design system fork (hardcoded colors instead of shared tokens).

## References

- [`domain-driven-design`](../domain-driven-design/SKILL.md) +
  [`product-architecture`](../product-architecture/SKILL.md) — layer
  boundaries the app must respect (ADR-0002 monorepo).
- [`api-integration`](../api-integration/SKILL.md) — HTTP/Zod conventions for
  the BFF + agent endpoints the app consumes.
- [`mcp-server-development`](../mcp-server-development/SKILL.md) — shared
  public surface (ADR-0017) powering both agents and mobile.
- [`auth-role-management`](../auth-role-management/SKILL.md) +
  [`supabase-postgres-rls`](../supabase-postgres-rls/SKILL.md) — auth/RLS.
- [`responsive-ui-architecture`](../responsive-ui-architecture/SKILL.md) —
  tokens, touch targets, tunnel rules mirrored natively.
- [`luxury-motion-effects`](../luxury-motion-effects/SKILL.md) — motion values.
- [`photo-quality-seo-geo-agentique`](../photo-quality-seo-geo-agentique/SKILL.md)
  — Cloudinary presets shared with `expo-image`.
- [`payment-orchestration`](../payment-orchestration/SKILL.md),
  [`security-engineering`](../security-engineering/SKILL.md),
  [`test-strategy`](../test-strategy/SKILL.md),
  [`cicd-release-management`](../cicd-release-management/SKILL.md),
  [`observability-monitoring`](../observability-monitoring/SKILL.md).
