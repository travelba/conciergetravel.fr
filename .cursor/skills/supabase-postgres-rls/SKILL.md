---
name: supabase-postgres-rls
description: Supabase PostgreSQL schema, migrations, and Row-Level Security policies for MyConciergeHotel.com. Use when adding/altering tables, indexes, RLS policies, generated columns, JSONB fields, or any database concern.
---

# Supabase PostgreSQL + RLS — MyConciergeHotel.com

The cahier des charges mandates **Supabase PostgreSQL with RLS native** (CDC §2). Every table that holds business data must have RLS enabled with explicit policies. We never disable RLS.

## Triggers

Invoke when:

- Creating a migration in `packages/db/migrations/`.
- Adding or altering tables: `hotels`, `hotel_rooms`, `bookings`, `editorial_pages`, `loyalty_members`, `booking_requests_email`, `price_comparisons`, `authors`, `profiles`, `redirects`, etc.
- Writing or editing RLS policies.
- Adding indexes, generated columns, JSONB fields, enum types.

## Tables and core fields (CDC v3.0 §4)

### `hotels`

- `id uuid pk default gen_random_uuid()`, `slug text unique not null`, `slug_en text unique`
- `name text not null`, `name_en text`
- `stars int check (stars = 5)`, `is_palace bool default false`
- `region text not null`, `department text`, `city text not null`, `district text`
- `address text`, `latitude decimal(9,6)`, `longitude decimal(9,6)`
- `amadeus_hotel_id text`, `little_hotel_id text`, `makcorps_hotel_id text` (cf. addendum v3.2)
- `booking_mode text not null check (booking_mode in ('amadeus','little','email','display_only'))`
- `description_fr text`, `description_en text`
- `highlights jsonb`, `amenities jsonb`, `restaurant_info jsonb`, `spa_info jsonb`
- `google_place_id text`, `google_rating decimal(2,1)`, `google_reviews_count int`, `last_reviews_sync timestamptz`
- `meta_title_fr/_en text`, `meta_desc_fr/_en text`, `faq_content jsonb`
- `is_little_catalog bool default false`
- `atout_france_id text`, `priority text default 'P1' check (priority in ('P0','P1','P2'))`
- `is_published bool default false`, `created_at`, `updated_at` (trigger)

### `hotel_rooms`

- `id uuid pk`, `hotel_id uuid references hotels(id) on delete cascade`
- `room_code text not null`, `name_fr/_en text`, `description_fr/_en text`
- `max_occupancy int`, `bed_type text`, `size_sqm int`, `amenities jsonb`, `images jsonb`

### `bookings`

- `id uuid pk`, `booking_ref text unique not null` (format `CT-YYYYMMDD-XXXXX`)
- `amadeus_pnr text`, `little_booking_id text`
- `hotel_id uuid references hotels(id)`, `room_id uuid references hotel_rooms(id)`
- `user_id uuid references auth.users(id)`
- Guest: `guest_firstname/lastname/email/phone`
- Stay: `checkin_date`, `checkout_date`, `nights int generated always as (checkout_date - checkin_date) stored`, `adults`, `children`
- Pricing: `rate_code`, `price_per_night`, `total_price`, `currency default 'EUR'`, `commission_rate`, `commission_amount`
- `cancellation_policy jsonb` (verbatim from Amadeus), `cancellation_deadline timestamptz`
- `payment_status text default 'pending' check (... in ('pending','authorized','captured','cancelled','refunded'))`
- `amadeus_payment_ref text`
- `status text default 'pending' check (... in ('pending','confirmed','cancelled','no_show','completed'))`
- `booking_channel text default 'amadeus' check (... in ('amadeus','little','email'))`
- `loyalty_tier text`, `loyalty_benefits jsonb`

### `editorial_pages`

- `id uuid`, `slug_fr text unique not null`, `slug_en text unique`
- `type text check (type in ('classement','thematique','region','guide','comparatif','saisonnier'))`
- `title_fr/_en`, `meta_desc_fr/_en`, `aeo_block_fr/_en` (40–60 mots)
- `hotel_ids uuid[]`, `author_id uuid references authors(id)`, `last_updated date`, `faq_content jsonb`, `word_count_target int`
- `status text default 'draft' check (status in ('draft','published'))`, `priority text check (priority in ('P0','P1','P2','P3'))`

### `loyalty_members`

- `id uuid pk references auth.users(id) on delete cascade`
- `tier text default 'free' check (tier in ('free','premium'))`, `tier_expiry date`, `total_bookings int default 0`
- `premium_price decimal(8,2)`

### `booking_requests_email`

- `id`, `hotel_id`, `guest_*`, `requested_checkin/checkout`, `room_preference`, `message`, `status (new/in_progress/quoted/booked/declined)`, `assigned_to`, `internal_notes`, `created_at`

### `price_comparisons`

- `id`, `hotel_id`, `checkin_date`, `checkout_date`, `price_concierge`, `price_booking`, `price_expedia`, `price_hotelscom`, `price_official`, `expires_at`

### `authors`, `profiles`, `redirects`

## Non-negotiable rules

### RLS

- `alter table <t> enable row level security;` on every business table.
- `service_role` bypass for migrations and admin server work; never expose service role to the client.
- Policies separated per role: `anon`, `authenticated`, `editor` (claim-based), `admin`, `operator`.
- Public read on `hotels`, `editorial_pages`, `hotel_rooms` only when `is_published = true`.
- Booking write policies allow only matching `auth.uid() = user_id` for SELECT/UPDATE; INSERT goes through service role from server actions.
- Loyalty members readable by owner + admin; writable by service role.

#### `auth_rls_initplan` advisor — the **exact** subquery shape matters

The Supabase advisor only credits the `auth.<fn>()` init-plan optimisation when the function call is the **immediate** child of the `SELECT` subquery. Anything else (operator, JSON-extract, cast) must live **outside** the parens. Mismatched parens are a real recurring source of WARN advisors — `0057` shipped with the wrong shape and required `0058` as a same-day fix.

```sql
-- ❌ Wrong — advisor still flags this even though it looks correct.
-- The `->> 'role'` is inside the subquery, so the optimisation does not register.
using ((select auth.jwt() ->> 'role') in ('operator', 'admin'))

-- ✅ Correct — `select auth.jwt()` is the immediate child of the subquery,
-- and the JSON extract / array membership happens outside.
using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']))
```

Same rule for `auth.uid()`:

```sql
-- ✅
using (user_id = (select auth.uid()))
```

The pattern in `IN (...)` vs `= any (array[...])` is interchangeable for correctness, but the canonical repo style is `= any (array[...])` because it survives copy-paste across policies without bracket gymnastics. Match the surrounding migrations.

**Always run `get_advisors` (performance lint) after applying a migration that introduces RLS policies.** If a new `auth_rls_initplan` WARN appears, ship a fix migration the same session — don't let the warning rot.

### Migrations

- Files numbered `NNNN_description.sql`. Idempotent if possible. Drizzle schema kept in sync.
- Each migration is reviewable as plain SQL. We commit raw SQL, not ORM-generated.
- New columns are nullable or have defaults to keep deploy zero-downtime.
- **Before picking a number, `Glob 'packages/db/migrations/NNNN_*'`**. Two
  files at the same number is a real foot-gun: the MCP `apply_migration`
  is read-only (we run the SQL through `pg` directly), and the
  `_cct_sql_migrations` ledger is keyed by `filename` — two files
  numbered 0029 end up with two unrelated entries and the rename costs
  three round-trips. Reference incident: 2026-05-17, `0029_hotel_upcoming_events.sql`
  → had to be renamed to `0031_*` because `0029_editorial_rankings_axes.sql`
  AND `0030_editorial_rankings_factual_summary.sql` already existed.
- **The Supabase MCP is read-only for write-DDL** in this project. To
  apply a migration, run it through `pg` with the SSL escape hatch:

  ```ts
  const conn = (process.env.SUPABASE_DB_POOLER_URL ?? '').replace(/[?&]sslmode=[^&]*/giu, '');
  const c = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(await readFile('packages/db/migrations/NNNN_*.sql', 'utf8'));
  await c.end();
  ```

  See `scripts/editorial-pilot/src/import/push-import.ts` for the canonical
  helper.

### Indexes

- `hotels(slug)` unique, `hotels(is_published, region, city)`, `hotels(makcorps_hotel_id) where makcorps_hotel_id is not null`.
- `bookings(user_id, status)`, `bookings(checkin_date)` for reporting.
- GIN on `hotels.faq_content`, `editorial_pages.faq_content`, `hotels.amenities`.
- `editorial_pages(slug_fr)` unique, `(type, status, priority)`.

### Generated columns and triggers

- `bookings.nights` generated.
- `updated_at` trigger via shared function `set_updated_at()`.
- Slug uniqueness validated by partial unique indexes when locale is involved.

### JSONB

- Validated by Zod at app layer before insert/update.
- Document expected shape in a comment at the top of the migration.

### Async HTTP from Postgres (`pg_net`) — gotchas

We use `pg_net` to let the agent loop apply ≥ 30 KB editorial seeds without
having to inline raw SQL through MCP tool calls (LLM regenerate-from-context
drift corrupts long opaque payloads — see `llm-output-robustness/SKILL.md`
§rule-10 for the failure mode). The pattern works but each step has a
trap. Don't relitigate these:

1. **`net.http_get(...)` is async + transactional.** It writes to the
   `net.http_request_queue` table inside the calling transaction. If the
   transaction rolls back (function raises, or PostgREST returns 4xx),
   the enqueue is erased before the pg_net worker ever sees it. So
   **never** loop-wait for the response inside the same function that
   enqueued it — every retry just enqueues, sleeps, times out, rolls
   back, repeat ad infinitum.

2. **`commit;` inside a procedure fails under MCP/PostgREST.** The
   obvious "fix" — `procedure ... { http_get(); commit; loop wait }` —
   raises `2D000: invalid transaction termination` because PostgREST
   wraps every `CALL` in its own transaction. The procedure is still
   useful for direct `psql` / `pg` clients, but it's dead-on-arrival
   for the agent loop.

3. **Split the workflow into two committable steps.** This is what
   `apply_itinerary_from_response(slug, request_id)` does (migration
   0054). Step 1 is a single `select net.http_get(...)` (one MCP call,
   auto-commits when the statement returns — worker can see it). Step
   2 is one `select apply_itinerary_from_response(...)` per slug after
   a few seconds of wait. The collect function does NOT call
   `http_get`, it only reads `net._http_response`.

4. **Worker cold-starts cost ~5 s after `create extension`.** The
   pg_net background worker doesn't process the queue immediately
   after the extension is created. The first request enqueued always
   times out unless you wait. Subsequent requests are fast (≤ 1 s for
   small bodies).

5. **`net._http_response` is keyed by `id bigint`.** The id grows
   monotonically across all requests in the project, not per slug.
   Keep the (slug, request_id) mapping from the enqueue call to feed
   it back into the collect function.

### DDL/DML guard regex in `EXECUTE`-style RPCs

When a `SECURITY DEFINER` function uses `EXECUTE v_body` on text from
an external source (HTTP, base64, file upload), it needs a guard
regex that refuses dangerous tokens. The trap: a regex like
`drop\s` matches editorial copy that says "car drop at the foot of
the Rocher" (English itinerary body). The guard must require a SQL
**object keyword** (`table`, `function`, `schema`, …) after the
verb, otherwise it false-positives on natural language:

```sql
-- ❌ Too aggressive — refuses any seed that contains "drop " in prose
if v_lowered ~ '(^|[^a-z_])drop\s' then ...

-- ✅ Requires a real DDL object after the verb
if v_lowered ~ '(^|[^a-z_])drop\s+(table|function|procedure|schema|view|index|extension|database|role|user|policy|trigger|sequence|materialized)\y' then ...
```

Migrations `0049`–`0054` are the canonical reference for the
agent-loop-friendly seed loader. The four-migration sequence
intentionally walks through each iteration mistake (forward-only
history) so the next agent doesn't repeat them.

## Anti-patterns to refuse

- Disabling RLS to "make it work".
- Adding a policy `using (true)` for any role that accepts user input.
- Writing migrations through Supabase Studio UI (must be in versioned SQL).
- Storing card data, even hashed (CDC §11 — PCI is delegated to Amadeus).
- Selecting `*` from `auth.users` in app code.

## Scripted ETL writes without a pooler URL — use PostgREST + service_role

The repo intentionally **does not commit a `SUPABASE_DB_POOLER_URL`**
to `.env.local` (the agent uses the Supabase MCP for ad-hoc SQL, and
the apps use `createServerClient` / `getSupabaseAdminClient`). When a
batch ETL script (e.g. scaffolding 400+ catalogue rows) needs to write
to Postgres, **use the PostgREST API directly** via the
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` that are
already in `.env.local`. No new env vars, no `pg` client.

```ts
const restBase = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// ✅ Idempotent bulk upsert — REQUIRES `?on_conflict=<col>`
const res = await fetch(`${restBase}/hotels?on_conflict=slug`, {
  method: 'POST',
  headers: {
    ...headers,
    Prefer: 'resolution=ignore-duplicates,return=representation',
  },
  body: JSON.stringify(rows), // array of objects, batch up to ~100
});
```

### Hard rules (PostgREST upsert)

1. **`Prefer: resolution=ignore-duplicates` is not enough.** Without
   `?on_conflict=<column>` in the URL the duplicate raises 23505 and
   aborts the **whole chunk** — you lose dozens of rows for one
   collision.
2. **Use `Prefer: resolution=merge-duplicates`** if you actually want
   to overwrite existing rows; `ignore-duplicates` skips them silently
   and `representation` returns only the inserted rows so you can
   count `+N/M`.
3. **JSONB merge can't be expressed in a single PATCH.** PostgREST
   does not parse `jsonb || expr` in the body. For idempotent jsonb
   appends, do a 2-RTT pattern: `GET ?select=external_sources` →
   compute merged value in JS (guard via `Array.some(...)`) → `PATCH`.
4. **Batch size sweet spot is 50.** Above ~200 rows PostgREST tail
   latency spikes; below 20 you waste round-trips. 50 keeps each
   chunk < 100 KB and < 2 s.

### Lesson learned (2026-05-25)

Scaffolding 418 Relais & Châteaux drafts hit `23505 duplicate slug`
on chunk 1 (we had already inserted one row via a probe MCP call).
Without `on_conflict=slug` the entire chunk of 50 was lost. Adding
`?on_conflict=slug` made the script fully idempotent — re-runs return
`+0` new rows instead of erroring. See
`scripts/editorial-pilot/src/global-sources/scaffold-relais-chateaux.ts`
for the reference implementation.

## References

- CDC v3.0 §4 (data model), §11 (security), addendum v3.2 (price_comparisons + makcorps_hotel_id).
- `auth-role-management`, `security-engineering` skills.
