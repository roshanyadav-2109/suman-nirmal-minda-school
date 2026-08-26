-- =============================================================================
-- Migration 0005 — Full-history assessment visibility for class teachers
-- A class teacher "inherits full context" (brief §2.1): they must see a current
-- student's PRIOR-year marks, which live in a different section (e.g. last year's
-- VII-A). mark_read already permits this (student ∈ my_ct_students), but
-- assessment_read denied the prior-year assessment rows, so the view's inner
-- join to `assessment` dropped the history. Allow reading the assessments of the
-- sections the caller's class-teacher students were ever enrolled in.
-- (Only assessment *definitions* widen; other students' marks stay hidden.)
-- =============================================================================

create or replace function app.my_ct_history_sections()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select distinct e.section_id from public.student_enrollment e
  where e.student_id in (select app.my_ct_students());
$$;

grant execute on function app.my_ct_history_sections() to authenticated, anon, service_role;

drop policy if exists assessment_read on public.assessment;
create policy assessment_read on public.assessment for select to authenticated using (
  (select app.is_admin_scope())
  or section_id in (select app.my_taught_sections())
  or section_id in (select app.my_owned_sections())
  or section_id in (select app.my_ct_history_sections())
);
