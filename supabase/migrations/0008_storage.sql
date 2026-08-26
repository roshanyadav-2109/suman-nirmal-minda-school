-- =============================================================================
-- Migration 0008 — Storage buckets (brief §6)
--   brand   : public — official KV emblem / brand assets
--   reports : private — generated monthly-report files (service-role writes,
--             served to families via signed URLs)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('brand', 'brand', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- Public read for brand assets (bucket is public, but be explicit).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='brand_public_read') then
    create policy brand_public_read on storage.objects
      for select to public using (bucket_id = 'brand');
  end if;
end $$;
