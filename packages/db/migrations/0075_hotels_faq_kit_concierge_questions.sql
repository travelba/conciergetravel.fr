-- 0075 — Hotels: Perplexity FAQ kit + concierge questions (two-tier FAQ model).
--
-- Context
-- -----
-- Kit fiches (golden template, Perplexity research) carry:
--   - faq_content_kit  → 40–60 factual Q&A grouped by intent (DOM / GEO)
--   - faq_content      → 10–15 promote subset (JSON-LD + publish gates)
--   - concierge_questions → 20–30 proactive concierge-voice Q&A
--
-- Standard fiches keep only faq_content (10–15). Kit columns stay null.
--
-- Skill: hotel-faq-perplexity-enrichment
-- Golden reference: les-airelles-gordes (DA/_generated/airelles-faq-data.json)

alter table public.hotels
  add column if not exists faq_content_kit jsonb;

alter table public.hotels
  add column if not exists concierge_questions jsonb;

alter table public.hotels
  drop constraint if exists hotels_faq_content_kit_shape_ck;
alter table public.hotels
  add constraint hotels_faq_content_kit_shape_ck
  check (faq_content_kit is null or jsonb_typeof(faq_content_kit) = 'array');

alter table public.hotels
  drop constraint if exists hotels_concierge_questions_shape_ck;
alter table public.hotels
  add constraint hotels_concierge_questions_shape_ck
  check (concierge_questions is null or jsonb_typeof(concierge_questions) = 'array');

create index if not exists hotels_faq_content_kit_gin
  on public.hotels using gin (faq_content_kit jsonb_path_ops);

create index if not exists hotels_concierge_questions_gin
  on public.hotels using gin (concierge_questions jsonb_path_ops);

comment on column public.hotels.faq_content_kit is
  'Extended Perplexity FAQ kit (40–60 factual Q&A with group_fr/group_en). Rendered in DOM for kit fiches; JSON-LD uses faq_content promote subset only.';

comment on column public.hotels.concierge_questions is
  'Concierge-voice Q&A (20–30): category_fr/en, question_fr/en, reply_fr/en. Proactive "Je m''en occupe" tone — separate from factual faq_content.';
