---
name: backoffice-cms
description: Payload CMS 3 back-office engineering for MyConciergeHotel.com — collections, RBAC, hooks, ISR revalidation, Cloudinary, custom endpoints, reporting. Use for any change in `apps/admin/` or to back-office workflows.
---

# Back-office (Payload CMS 3) — MyConciergeHotel.com

The cahier des charges (CDC v3.0 §11.1, §11.2) requires CRUD on hotels, rooms, editorial pages, FAQs, SEO, bookings, email requests, loyalty, reporting, and **publication without redeploy**. The chosen stack is **Payload CMS 3** (decided ADR 0003).

## Triggers

Invoke when:

- Editing `apps/admin/src/`.
- Adding a Payload collection or global.
- Wiring `afterChange`/`afterDelete`/`beforeValidate` hooks.
- Implementing custom endpoints, custom UI, or reporting views.

## Architecture

- `apps/admin` is a separate Next.js app embedding the Payload admin UI.
- Database: Postgres on Supabase (same DB as `apps/web`). Payload uses `@payloadcms/db-postgres`.
- Storage: Cloudinary via `@payloadcms/storage-cloudinary` (signed uploads).
- Authentication: Payload's own auth + role mapping (admin / editor / operator / seo). Optionally federated with Supabase Auth in Phase 2.

## Non-negotiable rules

### Schema parity with Postgres

- Payload collections **mirror** the SQL schema. Do not allow Payload to create columns drift; SQL migrations remain the source of truth.
- For SQL-only fields (e.g. generated `nights`, RLS-only flags), declare them in Payload as `read-only` mirrors.
- Collections that are purely operational (e.g. `Bookings` viewed in BO) are **read-mostly**: only specific fields are editable (`internal_notes`, `status` via guarded action).

### Hooks and ISR revalidation

- On `afterChange` of `Hotels`, `EditorialPages`, `Authors`, `Redirects`, `SiteSettings`: call `revalidateTag` on `apps/web` via a signed internal endpoint `/api/revalidate` (HMAC).
- Tags: `hotel:<slug>`, `editorial:<slug>`, `hub:<region>`, `author:<slug>`, `global:site-settings`.
- Same hook triggers Algolia reindex.

#### Direct SQL updates bypass `afterChange` — cache stays stale

When a row is updated via raw SQL (Supabase MCP `execute_sql`, a one-off
psql, a `packages/db/migrations/*.sql` data fix), **Payload hooks are not
invoked** — the DB sees the write but the Node process embedding Payload
never observes it. The cascade that normally fires (`revalidateTag(...)`
on `apps/web` + Algolia reindex) is silently skipped, so:

- `unstable_cache` keeps serving the stale projection until its TTL
  expires (`itineraries-hub` is 1 h post-`196d97e`, `editorial-pages`
  is 1 h, hotel-detail tags are 1 h).
- Hub pages with `revalidate = 86400` (or any > 3600) refresh **a full
  day later**, not at the next render — Next.js' ISR clock is independent
  of the cache layer.
- Algolia keeps returning the pre-update record set.

**Pattern for any SQL-direct content change** (status flip, bulk archive,
data correction):

1. Apply the SQL update via `user-supabase.execute_sql`.
2. Either:
   - **(preferred when feasible)** Re-touch the row from the Payload UI
     to fire the legitimate `afterChange` cascade, or
   - Call the internal `/api/admin/revalidate` endpoint with the exact
     tags you need (`itineraries-hub`, `hotel:<slug>`, …), or
   - Push a real code change to `apps/web/src/**` that incidentally
     invalidates the buildId (e.g. tighten the affected route's
     `revalidate` TTL — useful if the previous TTL was too lax).
3. Verify with a `WebFetch` on the public URL that the new shape is
   served before declaring the operation complete.

`git commit --allow-empty` does **not** work as an invalidation
trigger because Vercel's `turbo-ignore` cancels it — see
[`cicd-release-management/SKILL.md`](../cicd-release-management/SKILL.md)
Rule 10 for the long story.

Reference incident (24-25 May 2026): 19 itineraries flipped from
`draft` to `published` via `update public.itineraries set status =
'published' where status = 'draft'`. Detail pages rendered immediately
on `myconciergehotel.com/itineraire/<slug>` via SSR-fallback
(`dynamicParams` defaults to `true`), but the hub `/itineraires`
kept serving the cached "1 published itinerary" snapshot for hours.
The fix was tightening the hub's `revalidate = 86400` → `3600`
(commit `196d97e`), which both shipped a meaningful code improvement
AND happened to invalidate the cache. See
[`itinerary-editorial-pipeline/SKILL.md`](../itinerary-editorial-pipeline/SKILL.md)
for the editorial side of the same incident.

### RBAC

- `admin` — all.
- `editor` — Hotels (content fields, not connectivity), EditorialPages, FaqEntries, Authors, Media.
- `seo` — EditorialPages, Redirects, RobotsConfig, LlmsTxtSource, Hotels (SEO fields).
- `operator` — Bookings (notes, status), BookingRequestsEmail, LoyaltyMembers (tier adjust + audit).
- Field-level access enforced via Payload `access.update`.

### Custom endpoints

- `/api/admin/sync-google-reviews` — manual trigger; calls Google Places API per hotel; persists 3 latest reviews.
- `/api/admin/match-little` — operator workflow to match a hotel to a Little property.
- `/api/admin/reindex-algolia` — scoped to a hotel or full reindex with confirmation.
- `/api/admin/reports/*` — read-only reporting endpoints (sql views).

### Audit log

- `audit_logs` table populated by a `Hooks.afterOperation` writing actor + action + target + payload hash.
- Surfaced in a custom Payload view with filtering + CSV export.

### Editor experience

- Lexical-based rich-text editor for body content; constrained to allowed elements (heading levels, lists, callouts, comparison tables, hotel-card embed).
- Word counter and AEO validator visible in the page editor.
- Slug auto-derived from title with manual override.

### Reporting

- Lightweight reporting via SQL views: `reporting.bookings_per_hotel`, `reporting.commission_per_month`, `reporting.top_hotels_30d`, `reporting.email_requests_funnel`.
- Read-only Payload custom views render these with charts (Recharts).

### Sandboxing & previews

- Previews open the corresponding draft route in `apps/web` with `?preview=1` and a signed token. Token validated server-side.

## Anti-patterns to refuse

- Creating Payload collections without a matching SQL table.
- Adding business logic in Payload hooks that should live in `packages/domain/`.
- Direct mutations of `bookings` from Payload (write goes through domain services).
- Granting `editor` role write access to connectivity fields (booking_mode, IDs).
- Firing `revalidatePath('/')` from a hook (too broad — use scoped tags).

## References

- CDC v3.0 §11.1, §11.2, §15.
- ADR 0003 (Payload CMS).
- `content-modeling`, `auth-role-management`, `search-engineering`, `seo-technical` skills.
