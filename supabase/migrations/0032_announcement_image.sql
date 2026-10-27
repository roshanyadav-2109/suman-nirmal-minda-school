-- =============================================================================
-- Migration 0032 — Announcement images, and announcements for several sections.
--
-- 1. image_url: an optional picture. The image lives on Cloudinary (uploaded
--    from the browser with a server-signed request); the row keeps only its
--    address, and the check keeps that to Cloudinary image URLs.
--
-- 2. section_ids: send one announcement to any set of sections (e.g. every
--    section of VIII and IX except IX-C). Such a row is stored with
--    scope = 'section', section_id = the first chosen section (so the existing
--    scope check still holds) and section_ids = all of them. A reader sees it
--    if they can see ANY of the listed sections. The existing read policy is
--    untouched; this adds a second, permissive one alongside it.
-- =============================================================================
alter table public.announcement
  add column if not exists image_url text,
  add column if not exists section_ids bigint[];

alter table public.announcement
  drop constraint if exists announcement_image_url_cloudinary;
alter table public.announcement
  add constraint announcement_image_url_cloudinary
  check (image_url is null or image_url like 'https://res.cloudinary.com/%/image/upload/%');

alter table public.announcement
  drop constraint if exists announcement_section_ids_shape;
alter table public.announcement
  add constraint announcement_section_ids_shape
  check (section_ids is null or (scope = 'section' and cardinality(section_ids) > 0 and section_id = section_ids[1]));

create index if not exists announcement_section_ids_idx on public.announcement using gin (section_ids);

drop policy if exists announcement_read_sections on public.announcement;
create policy announcement_read_sections on public.announcement
  for select to authenticated using (
    section_ids is not null
    and exists (select 1 from unnest(section_ids) as s(id) where app.sees_section(s.id))
  );
