-- Migration: 0079_v2_schema_read_models.sql
-- ADR-0033 — bootstrap schema v2 read-models + user-facing tables (Phase 2)
--
-- Read-models SELECT from public.* (one-way). User tables live in v2 with
-- RLS (user_id = auth.uid() where applicable). See docs/adr/0033-v2-sql-schema-isolation.md

----------------------------------------------------------------
-- Schema + grants
----------------------------------------------------------------
create schema if not exists v2;

grant usage on schema v2 to anon, authenticated, service_role;

alter default privileges in schema v2
  grant select on tables to anon, authenticated;

alter default privileges in schema v2
  grant all on tables to service_role;

----------------------------------------------------------------
-- Helper: amenities facet subset for SRP filters (CDC v2 §5)
----------------------------------------------------------------
create or replace function v2.build_amenities_facet(amenities jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when amenities is null or jsonb_typeof(amenities) <> 'object' then '{}'::jsonb
    else jsonb_strip_nulls(
      jsonb_build_object(
        'has_spa', amenities -> 'has_spa',
        'has_pool', amenities -> 'has_pool',
        'has_restaurant', amenities -> 'has_restaurant',
        'has_parking', amenities -> 'has_parking',
        'wifi', amenities -> 'wifi',
        'pets_allowed', amenities -> 'pets_allowed',
        'has_gym', amenities -> 'has_gym',
        'has_kids_club', amenities -> 'has_kids_club',
        'is_all_inclusive', amenities -> 'is_all_inclusive'
      )
    )
  end;
$$;

comment on function v2.build_amenities_facet(jsonb) is
  'v2 read-model helper — ADR-0033. Projects boolean amenity flags for SRP facet filters.';

----------------------------------------------------------------
-- Views — published catalogue projections
----------------------------------------------------------------
create or replace view v2.hotel_card_v2
with (security_invoker = true)
as
select
  h.id,
  h.slug,
  h.slug_en,
  h.name,
  h.name_en,
  h.city,
  h.country_code,
  h.stars,
  h.hero_image,
  h.aggregate_rating_value as rating_score,
  h.aggregate_rating_count as rating_count,
  h.luxury_tier,
  h.price_from as price_hint,
  v2.build_amenities_facet(h.amenities) as amenities_facet
from public.hotels h
where h.is_published = true;

comment on view v2.hotel_card_v2 is
  'v2 read-model — ADR-0033. SRP / carousel hotel card projection from public.hotels.';

create or replace view v2.hotel_detail_v2
with (security_invoker = true)
as
select
  h.id,
  h.slug,
  h.slug_en,
  h.name,
  h.name_en,
  h.city,
  h.country_code,
  h.stars,
  h.hero_image,
  h.aggregate_rating_value as rating_score,
  h.aggregate_rating_count as rating_count,
  h.luxury_tier,
  h.price_from as price_hint,
  v2.build_amenities_facet(h.amenities) as amenities_facet,
  h.description_fr,
  h.description_en,
  h.factual_summary_fr,
  h.factual_summary_en,
  h.faq_content,
  h.policies,
  h.gallery_images,
  h.concierge_advice,
  h.long_description_sections,
  h.meta_desc_fr,
  h.meta_desc_en,
  h.affiliations,
  h.region,
  h.district,
  h.address,
  h.latitude,
  h.longitude,
  h.booking_mode,
  h.updated_at
from public.hotels h
where h.is_published = true;

comment on view v2.hotel_detail_v2 is
  'v2 read-model — ADR-0033. Full fiche projection (descriptions, FAQ, policies, gallery, concierge advice, long-read sections).';

create or replace view v2.ranking_card_v2
with (security_invoker = true)
as
select
  r.id,
  r.slug,
  r.title_fr,
  r.title_en,
  r.kind,
  r.hero_image,
  r.factual_summary_fr,
  r.factual_summary_en,
  r.meta_desc_fr,
  r.meta_desc_en,
  r.axes,
  coalesce(ec.entry_count, 0)::integer as entry_count,
  r.updated_at
from public.editorial_rankings r
left join lateral (
  select count(*)::integer as entry_count
  from public.editorial_ranking_entries ere
  where ere.ranking_id = r.id
) ec on true
where r.is_published = true;

comment on view v2.ranking_card_v2 is
  'v2 read-model — ADR-0033. Ranking hub card with live entry count from editorial_ranking_entries.';

grant select on v2.hotel_card_v2 to anon, authenticated;
grant select on v2.hotel_detail_v2 to anon, authenticated;
grant select on v2.ranking_card_v2 to anon, authenticated;

----------------------------------------------------------------
-- Tables — user account / personalization (v2-native)
----------------------------------------------------------------

create table if not exists v2.favorite_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  share_token text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint favorite_lists_name_ck check (char_length(trim(name)) between 1 and 120),
  constraint favorite_lists_share_token_ck check (
    share_token is null
    or share_token ~ '^[a-z0-9]{16,64}$'
  )
);

create unique index if not exists favorite_lists_share_token_uk
  on v2.favorite_lists (share_token)
  where share_token is not null;

create index if not exists favorite_lists_user_id_idx
  on v2.favorite_lists (user_id, created_at desc);

comment on table v2.favorite_lists is
  'v2 user wishlist collections — ADR-0033. Replaces flat user_favorites for multi-list UX.';

create table if not exists v2.favorite_list_items (
  list_id uuid not null references v2.favorite_lists (id) on delete cascade,
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  added_at timestamptz not null default timezone('utc', now()),
  constraint favorite_list_items_pk primary key (list_id, hotel_id)
);

create index if not exists favorite_list_items_hotel_id_idx
  on v2.favorite_list_items (hotel_id);

comment on table v2.favorite_list_items is
  'v2 wishlist entries — ADR-0033. Join table favorite_lists × hotels.';

create table if not exists v2.saved_travellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  email_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint saved_travellers_first_name_ck check (char_length(trim(first_name)) >= 1),
  constraint saved_travellers_last_name_ck check (char_length(trim(last_name)) >= 1),
  constraint saved_travellers_email_or_hash_ck check (
    email is not null or email_hash is not null
  )
);

create index if not exists saved_travellers_user_id_idx
  on v2.saved_travellers (user_id, created_at desc);

create trigger saved_travellers_set_updated_at
  before update on v2.saved_travellers
  for each row execute function public.set_updated_at();

comment on table v2.saved_travellers is
  'v2 saved traveller profiles for checkout — ADR-0033. Store email_hash at rest; plain email is optional legacy shape only.';

comment on column v2.saved_travellers.email_hash is
  'SHA-256 hex digest of normalised email — preferred over plain email column.';

create table if not exists v2.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null,
  notification_type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_preferences_pk primary key (user_id, channel, notification_type),
  constraint notification_preferences_channel_ck check (
    channel in ('email', 'push', 'whatsapp', 'sms')
  ),
  constraint notification_preferences_type_ck check (
    notification_type in (
      'booking_confirmation',
      'booking_reminder',
      'price_alert',
      'marketing',
      'member_program'
    )
  )
);

create trigger notification_preferences_set_updated_at
  before update on v2.notification_preferences
  for each row execute function public.set_updated_at();

comment on table v2.notification_preferences is
  'v2 per-user notification opt-in matrix — ADR-0033.';

create table if not exists v2.recently_viewed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  session_id text not null,
  hotel_slug text not null,
  viewed_at timestamptz not null default timezone('utc', now()),
  constraint recently_viewed_hotel_slug_ck check (
    hotel_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint recently_viewed_identity_ck check (
    user_id is not null or char_length(trim(session_id)) >= 8
  )
);

create index if not exists recently_viewed_user_id_viewed_at_idx
  on v2.recently_viewed (user_id, viewed_at desc)
  where user_id is not null;

create index if not exists recently_viewed_session_id_viewed_at_idx
  on v2.recently_viewed (session_id, viewed_at desc)
  where user_id is null;

create unique index if not exists recently_viewed_user_hotel_uk
  on v2.recently_viewed (user_id, hotel_slug)
  where user_id is not null;

create unique index if not exists recently_viewed_session_hotel_uk
  on v2.recently_viewed (session_id, hotel_slug)
  where user_id is null;

comment on table v2.recently_viewed is
  'v2 recently viewed hotels (signed-in or anonymous session) — ADR-0033.';

create table if not exists v2.member_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'base',
  confirmed_stays_count integer not null default 0,
  window_start date not null default (timezone('utc', now()))::date,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint member_status_tier_ck check (tier in ('base', 'gold', 'platinum')),
  constraint member_status_stays_ck check (confirmed_stays_count >= 0)
);

create trigger member_status_set_updated_at
  before update on v2.member_status
  for each row execute function public.set_updated_at();

comment on table v2.member_status is
  'v2 programme membre tier snapshot (Base/Gold/Platinum) — ADR-0033. Distinct from public.loyalty_members (v1 club/prestige).';

create table if not exists v2.hotel_keywords_v2 (
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  locale text not null,
  keywords jsonb not null default '[]'::jsonb,
  paa jsonb not null default '[]'::jsonb,
  grounded_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hotel_keywords_v2_pk primary key (hotel_id, locale),
  constraint hotel_keywords_v2_locale_ck check (locale in ('fr', 'en', 'de', 'es', 'it'))
);

create index if not exists hotel_keywords_v2_grounded_at_idx
  on v2.hotel_keywords_v2 (grounded_at desc nulls last);

create trigger hotel_keywords_v2_set_updated_at
  before update on v2.hotel_keywords_v2
  for each row execute function public.set_updated_at();

comment on table v2.hotel_keywords_v2 is
  'v2 DataForSEO grounding cache per hotel × locale — ADR-0033. Populated by editorial pipelines; read-only for clients.';

create table if not exists v2.hotel_supplier_codes (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  giata_id text,
  supplier text not null,
  supplier_hotel_code text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hotel_supplier_codes_supplier_ck check (
    supplier in ('travelport', 'ratehawk', 'little_emperors', 'expedia', 'bedsonline')
  ),
  constraint hotel_supplier_codes_identity_uk unique (hotel_id, supplier)
);

create index if not exists hotel_supplier_codes_giata_id_idx
  on v2.hotel_supplier_codes (giata_id)
  where giata_id is not null;

create trigger hotel_supplier_codes_set_updated_at
  before update on v2.hotel_supplier_codes
  for each row execute function public.set_updated_at();

comment on table v2.hotel_supplier_codes is
  'v2 supplier property crosswalk (Phase 9 booking) — ADR-0033. Seeded from GIATA; staff/service_role only.';

----------------------------------------------------------------
-- Table grants (RLS filters row access)
----------------------------------------------------------------
grant select, insert, update, delete on v2.favorite_lists to authenticated;
grant select, insert, update, delete on v2.favorite_list_items to authenticated;
grant select, insert, update, delete on v2.saved_travellers to authenticated;
grant select, insert, update, delete on v2.notification_preferences to authenticated;
grant select, insert, update, delete on v2.recently_viewed to authenticated;
grant select, insert, update, delete on v2.member_status to authenticated;

grant select on v2.hotel_keywords_v2 to anon, authenticated;
grant all on v2.hotel_keywords_v2 to service_role;

grant select on v2.hotel_supplier_codes to authenticated;
grant all on v2.hotel_supplier_codes to service_role;

----------------------------------------------------------------
-- RLS — user-owned tables (user_id = auth.uid())
----------------------------------------------------------------
alter table v2.favorite_lists enable row level security;
alter table v2.favorite_list_items enable row level security;
alter table v2.saved_travellers enable row level security;
alter table v2.notification_preferences enable row level security;
alter table v2.recently_viewed enable row level security;
alter table v2.member_status enable row level security;
alter table v2.hotel_keywords_v2 enable row level security;
alter table v2.hotel_supplier_codes enable row level security;

-- favorite_lists
drop policy if exists favorite_lists_select_own on v2.favorite_lists;
create policy favorite_lists_select_own on v2.favorite_lists
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists favorite_lists_insert_own on v2.favorite_lists;
create policy favorite_lists_insert_own on v2.favorite_lists
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists favorite_lists_update_own on v2.favorite_lists;
create policy favorite_lists_update_own on v2.favorite_lists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists favorite_lists_delete_own on v2.favorite_lists;
create policy favorite_lists_delete_own on v2.favorite_lists
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- favorite_list_items (ownership via parent list)
drop policy if exists favorite_list_items_select_own on v2.favorite_list_items;
create policy favorite_list_items_select_own on v2.favorite_list_items
  for select to authenticated
  using (
    exists (
      select 1
      from v2.favorite_lists fl
      where fl.id = favorite_list_items.list_id
        and fl.user_id = (select auth.uid())
    )
  );

drop policy if exists favorite_list_items_insert_own on v2.favorite_list_items;
create policy favorite_list_items_insert_own on v2.favorite_list_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from v2.favorite_lists fl
      where fl.id = favorite_list_items.list_id
        and fl.user_id = (select auth.uid())
    )
  );

drop policy if exists favorite_list_items_delete_own on v2.favorite_list_items;
create policy favorite_list_items_delete_own on v2.favorite_list_items
  for delete to authenticated
  using (
    exists (
      select 1
      from v2.favorite_lists fl
      where fl.id = favorite_list_items.list_id
        and fl.user_id = (select auth.uid())
    )
  );

-- saved_travellers
drop policy if exists saved_travellers_select_own on v2.saved_travellers;
create policy saved_travellers_select_own on v2.saved_travellers
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists saved_travellers_insert_own on v2.saved_travellers;
create policy saved_travellers_insert_own on v2.saved_travellers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists saved_travellers_update_own on v2.saved_travellers;
create policy saved_travellers_update_own on v2.saved_travellers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists saved_travellers_delete_own on v2.saved_travellers;
create policy saved_travellers_delete_own on v2.saved_travellers
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notification_preferences
drop policy if exists notification_preferences_select_own on v2.notification_preferences;
create policy notification_preferences_select_own on v2.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_insert_own on v2.notification_preferences;
create policy notification_preferences_insert_own on v2.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_update_own on v2.notification_preferences;
create policy notification_preferences_update_own on v2.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_delete_own on v2.notification_preferences;
create policy notification_preferences_delete_own on v2.notification_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- recently_viewed — signed-in users only via RLS (anon tracked server-side)
drop policy if exists recently_viewed_select_own on v2.recently_viewed;
create policy recently_viewed_select_own on v2.recently_viewed
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists recently_viewed_insert_own on v2.recently_viewed;
create policy recently_viewed_insert_own on v2.recently_viewed
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists recently_viewed_update_own on v2.recently_viewed;
create policy recently_viewed_update_own on v2.recently_viewed
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists recently_viewed_delete_own on v2.recently_viewed;
create policy recently_viewed_delete_own on v2.recently_viewed
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- member_status
drop policy if exists member_status_select_own on v2.member_status;
create policy member_status_select_own on v2.member_status
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists member_status_insert_own on v2.member_status;
create policy member_status_insert_own on v2.member_status
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists member_status_update_own on v2.member_status;
create policy member_status_update_own on v2.member_status
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- hotel_keywords_v2 — published catalogue read; writes via service_role
drop policy if exists hotel_keywords_v2_select_published on v2.hotel_keywords_v2;
create policy hotel_keywords_v2_select_published on v2.hotel_keywords_v2
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.hotels h
      where h.id = hotel_keywords_v2.hotel_id
        and h.is_published = true
    )
  );

-- hotel_supplier_codes — staff read (Phase 9 prep)
drop policy if exists hotel_supplier_codes_select_staff on v2.hotel_supplier_codes;
create policy hotel_supplier_codes_select_staff on v2.hotel_supplier_codes
  for select to authenticated
  using (
    (select auth.jwt() ->> 'role') in ('editor', 'seo', 'operator', 'admin')
  );

----------------------------------------------------------------
-- Migration log
----------------------------------------------------------------
insert into public._cct_sql_migrations (filename, applied_at)
  values ('0079_v2_schema_read_models.sql', timezone('utc', now()))
  on conflict do nothing;
