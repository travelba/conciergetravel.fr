-- ---------------------------------------------------------------------------
-- 0077_contact_requests
-- General concierge lead funnel (/le-concierge/contact). Mirrors the
-- booking_requests_email shape + RLS so the same operator/admin triage rules
-- apply. Forward-only. See docs/runbooks/PROJET-MASTER-PLAN.md (R1.5) and
-- docs/runbooks/audit-contenu-vers-produit-2026-06.md (lead bridge gap).
-- ---------------------------------------------------------------------------
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  request_ref text not null,
  submitted_by uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  locale text not null default 'fr',
  constraint contact_requests_locale_ck check (locale in ('fr', 'en')),
  source text not null default 'contact_page',
  status text not null default 'new',
  constraint contact_requests_status_ck check (
    status in ('new', 'in_progress', 'answered', 'closed')
  ),
  constraint contact_requests_request_ref_format_ck check (
    request_ref ~ '^CR-[0-9]{8}-[A-Z0-9]{5}$'
  ),
  assigned_to uuid references auth.users (id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists contact_requests_request_ref_idx
  on public.contact_requests (request_ref);
create index if not exists contact_requests_status_idx
  on public.contact_requests (status);
create index if not exists contact_requests_submitted_by_idx
  on public.contact_requests (submitted_by);
create index if not exists contact_requests_assigned_to_idx
  on public.contact_requests (assigned_to);
create index if not exists contact_requests_created_at_idx
  on public.contact_requests (created_at desc);

create trigger contact_requests_set_updated_at
before update on public.contact_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — mirrors booking_requests_email (0007). Anonymous inserts allowed
-- (submitted_by null); a signed-in customer may see only their own rows;
-- operator/admin see + manage everything. Service-role (server inserts)
-- bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table public.contact_requests enable row level security;

drop policy if exists contact_requests_select on public.contact_requests;
create policy contact_requests_select on public.contact_requests
  for select to authenticated
  using (
    submitted_by = (select auth.uid())
    or ((select auth.jwt()) ->> 'role') = any (array['operator', 'admin'])
  );

drop policy if exists contact_requests_insert on public.contact_requests;
create policy contact_requests_insert on public.contact_requests
  for insert to authenticated
  with check (
    ((select auth.jwt()) ->> 'role') = any (array['operator', 'admin'])
    or (
      coalesce(((select auth.jwt()) ->> 'role'), 'customer') <> all (
        array['editor', 'seo', 'operator', 'admin']
      )
      and (submitted_by is null or submitted_by = (select auth.uid()))
    )
  );

drop policy if exists contact_requests_update_staff on public.contact_requests;
create policy contact_requests_update_staff on public.contact_requests
  for update to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']))
  with check (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));

drop policy if exists contact_requests_delete_staff on public.contact_requests;
create policy contact_requests_delete_staff on public.contact_requests
  for delete to authenticated
  using (((select auth.jwt()) ->> 'role') = any (array['operator', 'admin']));
