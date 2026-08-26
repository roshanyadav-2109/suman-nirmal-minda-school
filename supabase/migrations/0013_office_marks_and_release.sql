-- =============================================================================
-- Migration 0013 — Office marks entry + results release workflow
--   * Office/Admin can enter & update marks for any student.
--   * Each assessment has a publish flag. Students/parents see a mark ONLY once
--     its assessment is released; staff always see it (draft while working).
--   * Existing seeded assessments are backfilled as published so the demo keeps
--     showing data; new assessments start as draft.
-- =============================================================================

alter table public.assessment
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz;

-- Backfill existing assessments as released (keep the demo populated).
update public.assessment set is_published = true, published_at = coalesce(published_at, now())
where is_published = false;

-- Helper: is the caller the office/admin?
create or replace function app.is_office()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(app.my_staff_role() = 'office', false);
$$;
grant execute on function app.is_office() to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- mark_read: staff see everything (incl. drafts); owners only PUBLISHED marks.
-- ---------------------------------------------------------------------------
drop policy if exists mark_read on public.mark;
create policy mark_read on public.mark for select to authenticated using (
  (select app.is_admin_scope())                                  -- principal / office
  or student_id in (select app.my_ct_students())                 -- class teacher (full)
  or exists (select 1 from public.assessment a                   -- subject teacher (their subject×section)
             where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  or (                                                            -- owner: only released results
       student_id in (select app.my_owned_students())
       and exists (select 1 from public.assessment a where a.id = mark.assessment_id and a.is_published)
     )
);

-- ---------------------------------------------------------------------------
-- mark_write: class teacher, subject teacher, OR office (not principal).
-- ---------------------------------------------------------------------------
drop policy if exists mark_write on public.mark;
create policy mark_write on public.mark for all to authenticated
  using (
    (select app.is_office())
    or student_id in (select app.my_ct_students())
    or exists (select 1 from public.assessment a where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  ) with check (
    (select app.is_office())
    or student_id in (select app.my_ct_students())
    or exists (select 1 from public.assessment a where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  );

-- assessment_write already allows office (is_admin_scope) + teachers, so the
-- publish toggle (updating is_published) is covered by that policy.
