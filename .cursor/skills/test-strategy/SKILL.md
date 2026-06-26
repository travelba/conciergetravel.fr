---
name: test-strategy
description: Test strategy for MyConciergeHotel.com — unit (Vitest), integration (Vitest + MSW), E2E (Playwright), accessibility (axe), Lighthouse CI. Use whenever you add or change tests, test config, or coverage rules.
---

# Test strategy — MyConciergeHotel.com

We follow the **trophy** model: a thick base of unit tests on `packages/domain/`, a strong integration layer on `packages/integrations/` with mocked vendors, and focused E2E on critical user journeys. Lighthouse CI guards performance.

## Triggers

Invoke when:

- Adding business logic, an integration, a route, or a UI flow that must be regression-protected.
- Editing CI test workflows.
- Adjusting coverage thresholds or fixtures.

> ⚠ **Tests are necessary but not sufficient.** Passing `lint` +
> `typecheck` + `test:unit` does NOT prove that a feature is visible to
> a real user. Before any commit/push that touches a public surface,
> the agent MUST also walk the change as a user — see
> [`user-acceptance-loop`](../user-acceptance-loop/SKILL.md) and the
> hard rule `.cursor/rules/user-acceptance-before-commit.mdc`. The
> 2026-05-26 Concierge Club case is the cautionary tale: green CI,
> invisible feature.

## Frameworks

- **Unit/integration**: Vitest + `@vitest/coverage-v8`.
- **HTTP mocking**: MSW for vendor APIs.
- **DOM**: `@testing-library/react` for React Email + UI components.
- **E2E**: Playwright (Chromium, WebKit, Firefox; mobile viewport project).
- **a11y**: `@axe-core/playwright`.
- **Performance**: Lighthouse CI on 5 strategic URLs.

## Coverage targets

- `packages/domain/**` — **≥ 90%** lines / branches.
- `packages/integrations/**` — **≥ 80%** lines (mocked).
- `apps/web/**` — **≥ 70%** for server actions, route handlers, business components.
- `apps/admin/**` — **≥ 60%** (CMS surface, mostly Payload).

## Non-negotiable rules

### Unit tests

- Live next to source: `*.test.ts(x)`.
- Pure: no network, no DB. Inject ports.
- Test boundary conditions and error cases.
- Snapshot tests reserved for pure rendering of small atoms; refuse for full pages.

### Integration tests

- Use MSW handlers in `tests/fixtures/msw/<vendor>.ts`.
- Cover happy path + 429 + 5xx + parse failure for each integration function.
- Validate Zod parse errors propagate as typed `Result.err({ kind: 'parse_failure' })`.

### E2E tests (Playwright)

Mandatory journeys:

1. **Search → results → hotel detail → booking tunnel → confirmation** on mobile viewport (375×812) and desktop (1280×720).
2. **Email-mode booking request** (hotel with `booking_mode = 'email'`).
3. **Account flow** (signup, login, view bookings, view loyalty).
4. **Editorial pages** SEO checks: titles, JSON-LD validity, breadcrumbs, hreflang, canonical.
5. **Price comparator** rendering + scenarios (cheaper / equal_with_benefits / more_expensive).
6. **Sitemap and robots** content checks.

### a11y

- Run `axe.run()` on home, hotel detail, booking step 3, account, editorial classement.
- Must report **zero serious violations**.

### Lighthouse CI

- Targets per CDC §9.2 (Mobile LCP < 2.0s, CLS < 0.05, INP < 200ms, score > 90).
- Run on PRs and main branch.

### Test data

- Fixtures in `tests/fixtures/` (`amadeus/*.json`, `little/*.json`, `makcorps/*.json`).
- Database fixtures use Supabase local (`supabase start`) or in-memory pglite for super-fast unit tests.

### Flake control

- Retries: 1 in CI, 0 locally.
- No sleep-based waits — use Playwright auto-waiting + custom `expect.poll`.

## Anti-patterns to refuse

- Tests calling real Amadeus/Little/Makcorps in CI (only nightly smoke job).
- Snapshotting full HTML pages.
- Using `setTimeout` to wait for state.
- Mocking `fetch` globally instead of per-request via MSW.
- Skipped tests committed without a tracking issue.

## CI integration

- `lint`, `typecheck`, `test:unit` run on every PR.
- `test:e2e` runs on PR opened against `main` and on push to `main`.
- `lighthouse-ci` runs on push to `main` and weekly on `production`.
- Nightly job: smoke E2E against Amadeus test environment.

## L3 — exhaustive site health (the layer E2E can't cover)

E2E + axe + Lighthouse sample a curated set of journeys/URLs. They cannot prove
that **all** ~8 200 published URLs (hotels + rankings + guides + places + rooms)
actually work, click, and stay coherent. That exhaustive layer is the
**site-audit crawler** ([`site-audit-crawler`](../site-audit-crawler/SKILL.md),
`scripts/site-audit`): it walks the sitemap and asserts per URL — HTTP 200,
single `<h1>`, title/meta/canonical, hreflang parity, no scaffolding leak in
prose, valid JSON-LD (no frozen `Offer`, `AggregateRating` on /5), live internal
links + images, and the anti-"0 hôtels" list-value check. Run it report-only
against prod, or as a gate against a Vercel preview / scheduled cron (L6). It is
the automated form of [`user-acceptance-loop`](../user-acceptance-loop/SKILL.md)
§Assert VALUES, applied to the whole catalogue.

## References

- CDC v3.0 §9.2 (Core Web Vitals), §12 (acceptance checklists).
- `cicd-release-management`, `performance-engineering`, `accessibility` skills.
- [`user-acceptance-loop`](../user-acceptance-loop/SKILL.md) — manual
  user walk-through (mandatory pre-commit when the change is rendered).
- `.cursor/rules/user-acceptance-before-commit.mdc` — hard rule.
