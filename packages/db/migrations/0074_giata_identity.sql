-- 0074 — GIATA identity layer for multi-supplier property mapping.
--
-- GIATA Multicodes is the canonical property ID + supplier crosswalk source.
-- It does NOT serve live ARI — runtime pricing stays on LE / RateHawk / Travelport.
--
-- Flow:
--   1. Resolve `hotels.giata_id` (batch or manual).
--   2. Sync `giata_supplier_properties` from GIATA API.
--   3. Upsert `hotel_supplier_connections` from verified crosswalk rows.
--
-- Skill: multi-supplier-booking, supabase-postgres-rls, api-integration.
-- ADR: docs/adr/0026-multi-supplier-booking-giata.md

----------------------------------------------------------------
-- 1. hotels.giata_id — canonical GIATA property identifier
----------------------------------------------------------------

alter table public.hotels
  add column if not exists giata_id text;

comment on column public.hotels.giata_id is
  'GIATA Multicodes property ID. Source of truth for supplier crosswalk seeding.';

create unique index if not exists hotels_giata_id_unique_idx
  on public.hotels (giata_id)
  where giata_id is not null and giata_id <> '';

----------------------------------------------------------------
-- 2. giata_supplier_properties — supplier codes per GIATA property
----------------------------------------------------------------

create table if not exists public.giata_supplier_properties (
  id                    uuid primary key default gen_random_uuid(),
  giata_id              text not null,
  supplier              text not null,
  -- Mirrors hotel_supplier_connections.supplier_property_key shapes:
  --   travelport      : { "chainCode", "propertyCode" }
  --   ratehawk        : { "hotelId" }
  --   little_emperors : { "propertyRef" }
  supplier_property_key jsonb not null,
  -- Set when matched to a catalogue row (by giata_id or manual link).
  hotel_id              uuid references public.hotels (id) on delete set null,
  provider_code_raw     text,
  confidence            text not null default 'giata_api',
  fetched_at            timestamptz not null default timezone('utc', now()),
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now()),

  constraint giata_supplier_properties_supplier_ck
    check (supplier in ('travelport', 'ratehawk', 'little_emperors')),
  constraint giata_supplier_properties_confidence_ck
    check (confidence in ('giata_api', 'manual', 'auto_high', 'auto_medium')),
  constraint giata_supplier_properties_identity_unique
    unique (giata_id, supplier)
);

create index if not exists giata_supplier_properties_hotel_id_idx
  on public.giata_supplier_properties (hotel_id);

create index if not exists giata_supplier_properties_giata_id_idx
  on public.giata_supplier_properties (giata_id);

create trigger giata_supplier_properties_set_updated_at
  before update on public.giata_supplier_properties
  for each row execute function public.set_updated_at();

----------------------------------------------------------------
-- 3. RLS — staff read; operator/admin write (same pattern as 0071)
----------------------------------------------------------------

alter table public.giata_supplier_properties enable row level security;

create policy giata_supplier_properties_select_staff
  on public.giata_supplier_properties
  for select
  to authenticated
  using (
    (auth.jwt() ->> 'role') in ('editor', 'seo', 'operator', 'admin')
  );

create policy giata_supplier_properties_write_operator
  on public.giata_supplier_properties
  for all
  to authenticated
  using ((auth.jwt() ->> 'role') in ('operator', 'admin'))
  with check ((auth.jwt() ->> 'role') in ('operator', 'admin'));
