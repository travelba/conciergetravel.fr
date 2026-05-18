-- 0032 — Hotel detail: `concierge_advice` block (Voix du Concierge).
--
-- Voir [ADR-0011](../../docs/adr/0011-concierge-voice.md) et
-- `EDITORIAL_VOICE.md` §4 bloc 8.
--
-- Le « Conseil du Concierge » est un encart obligatoire (60-90 mots FR/EN)
-- en bas de chaque fiche hôtel, juste avant la FAQ. Il porte la voix de
-- marque distinctive (« Mon conseil : demandez la chambre X »).
--
-- Différence avec le kind `concierge_tip` des `editorial_callouts`
-- (migration 0027) :
--   - `editorial_callouts.concierge_tip` = encart dispersé dans les guides
--     et rankings (sidebar boxes répartis dans un long-read).
--   - `hotels.concierge_advice` = bloc canonique unique en bas de fiche
--     hôtel, contraint en taille, traité comme une donnée structurée du
--     fiche product (pas un encart éditorial libre).
--
-- Shape (mirror du zod schema `ConciergeAdviceSchema` côté
--  `apps/web/src/server/hotels/get-hotel-by-slug.ts`) :
--   {
--     fr: {
--       title,                   -- ex. "Le Conseil du Concierge"
--       body,                    -- 60-90 mots, voix Concierge
--       tip_for                  -- 'room' | 'dining' | 'timing' | 'access'
--                                --  | 'service' | 'wellness' (enum lib)
--     },
--     en: { title, body, tip_for }
--   }
--
-- Validation Payload (Phase 1.5) : refuse publish si body manquant OU
-- < 60 mots OU > 90 mots (FR comme EN).

alter table public.hotels
  add column if not exists concierge_advice jsonb;

comment on column public.hotels.concierge_advice is
  'Bloc « Le Conseil du Concierge » en bas de fiche (CDC §2 + ADR-0011). Shape: {fr:{title,body,tip_for}, en:{title,body,tip_for}}. body = 50-110 mots (relâché depuis l''objectif initial 60-90 après audit Phase 3 sur 106 fiches). tip_for enum: room, dining, timing, access, service, wellness.';

-- Log this migration so the orchestrator can detect schema drift.
insert into public._cct_sql_migrations (filename) values ('0032_hotel_concierge_advice.sql')
  on conflict do nothing;
