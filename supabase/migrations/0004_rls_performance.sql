-- =============================================================================
-- Migration 0004 — RLS performance rewrite
-- The 0002 policies used per-row correlated subqueries (owns_student,
-- can_view_student_subject) which scan every row and time out on large tables
-- (mark: ~22k rows). This migration replaces the hot-path policies with
-- set-returning helpers used via `col IN (select app.fn())` — Postgres builds a
-- single hashed subplan evaluated ONCE per query and can hash-probe it cheaply.
--
-- Semantics preserved:
--   * subject teacher  -> their subject × their allotted sections
--   * class teacher     -> their whole section, ALL subjects, FULL history
--                          (via current-enrollment membership, so prior-year
--                           marks in other sections still resolve)
--   * principal/office  -> everything
--   * guardian/student  -> own record(s) only; never slippage/needs-support
-- =============================================================================

-- Student ids the caller OWNS (student = self; guardian = children).
create or replace function app.my_owned_students()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select student_id from public.profile where id = auth.uid() and role = 'student'
  union
  select gs.student_id from public.profile p
    join public.guardian_student gs on gs.guardian_id = p.guardian_id
  where p.id = auth.uid() and p.role = 'guardian';
$$;

-- Sections the caller has ANY allotment in this year (CT or subject teacher).
create or replace function app.my_taught_sections()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select distinct section_id from public.teacher_allotment
  where staff_id = app.my_staff_id() and academic_year_id = app.current_year_id();
$$;

-- Sections where the caller is the class teacher this year.
create or replace function app.my_ct_sections()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select distinct section_id from public.teacher_allotment
  where staff_id = app.my_staff_id() and academic_year_id = app.current_year_id() and is_class_teacher;
$$;

-- Students currently enrolled in the caller's class-teacher sections
-- (seen in FULL: all subjects, full history).
create or replace function app.my_ct_students()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select distinct e.student_id from public.student_enrollment e
  where e.academic_year_id = app.current_year_id()
    and e.section_id in (select app.my_ct_sections());
$$;

-- All students the caller may see at roster level: owned ∪ (in taught sections).
create or replace function app.my_scope_students()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select app.my_owned_students()
  union
  select e.student_id from public.student_enrollment e
  where e.academic_year_id = app.current_year_id()
    and e.section_id in (select app.my_taught_sections());
$$;

-- Sections (any year) of the caller's owned students — lets a student/guardian
-- read the assessment metadata behind their historical marks.
create or replace function app.my_owned_sections()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select distinct e.section_id from public.student_enrollment e
  where e.student_id in (select app.my_owned_students());
$$;

-- (section, subject) pairs the caller teaches as a SUBJECT teacher this year.
create or replace function app.my_allot_pairs()
returns table(section_id bigint, subject_id bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select section_id, subject_id from public.teacher_allotment
  where staff_id = app.my_staff_id() and academic_year_id = app.current_year_id()
    and subject_id is not null;
$$;

grant execute on all functions in schema app to authenticated, anon, service_role;

-- ===========================================================================
-- Replace hot-path policies
-- ===========================================================================
drop policy if exists student_read      on public.student;
drop policy if exists enroll_read       on public.student_enrollment;
drop policy if exists mark_read         on public.mark;
drop policy if exists mark_write        on public.mark;
drop policy if exists attendance_read   on public.attendance_record;
drop policy if exists attendance_write  on public.attendance_record;
drop policy if exists observation_read  on public.observation;
drop policy if exists observation_write on public.observation;
drop policy if exists assessment_read   on public.assessment;
drop policy if exists assessment_write  on public.assessment;
drop policy if exists mreport_read      on public.monthly_report;
drop policy if exists mreport_write     on public.monthly_report;
drop policy if exists slippage_read     on public.slippage_flag;
drop policy if exists guardian_read     on public.guardian;
drop policy if exists gs_read           on public.guardian_student;

-- student ---------------------------------------------------------------------
create policy student_read on public.student for select to authenticated using (
  (select app.is_admin_scope()) or id in (select app.my_scope_students())
);

-- enrollment ------------------------------------------------------------------
create policy enroll_read on public.student_enrollment for select to authenticated using (
  (select app.is_admin_scope()) or student_id in (select app.my_scope_students())
);

-- mark ------------------------------------------------------------------------
create policy mark_read on public.mark for select to authenticated using (
  (select app.is_admin_scope())
  or student_id in (select app.my_owned_students())          -- owner
  or student_id in (select app.my_ct_students())             -- class teacher: full history
  or exists (select 1 from public.assessment a               -- subject teacher: their subject×section
             where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
);
create policy mark_write on public.mark for all to authenticated
  using (
    (select app.is_admin_scope())
    or student_id in (select app.my_ct_students())
    or exists (select 1 from public.assessment a where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  ) with check (
    (select app.is_admin_scope())
    or student_id in (select app.my_ct_students())
    or exists (select 1 from public.assessment a where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  );

-- attendance ------------------------------------------------------------------
create policy attendance_read on public.attendance_record for select to authenticated using (
  (select app.is_admin_scope())
  or student_id in (select app.my_owned_students())
  or section_id in (select app.my_taught_sections())
);
create policy attendance_write on public.attendance_record for all to authenticated
  using ((select app.is_admin_scope()) or section_id in (select app.my_taught_sections()))
  with check ((select app.is_admin_scope()) or section_id in (select app.my_taught_sections()));

-- observation -----------------------------------------------------------------
create policy observation_read on public.observation for select to authenticated using (
  (select app.is_admin_scope())
  or student_id in (select app.my_scope_students())
  or (visible_to_guardian and student_id in (select app.my_owned_students()))
);
create policy observation_write on public.observation for all to authenticated
  using ((select app.is_admin_scope()) or (staff_id = (select app.my_staff_id()) and student_id in (select app.my_scope_students())))
  with check ((select app.is_admin_scope()) or (staff_id = (select app.my_staff_id()) and student_id in (select app.my_scope_students())));

-- assessment ------------------------------------------------------------------
create policy assessment_read on public.assessment for select to authenticated using (
  (select app.is_admin_scope())
  or section_id in (select app.my_taught_sections())
  or section_id in (select app.my_owned_sections())
);
create policy assessment_write on public.assessment for all to authenticated
  using (
    (select app.is_admin_scope())
    or section_id in (select app.my_ct_sections())
    or (section_id, subject_id) in (select section_id, subject_id from app.my_allot_pairs())
  ) with check (
    (select app.is_admin_scope())
    or section_id in (select app.my_ct_sections())
    or (section_id, subject_id) in (select section_id, subject_id from app.my_allot_pairs())
  );

-- monthly report --------------------------------------------------------------
create policy mreport_read on public.monthly_report for select to authenticated using (
  (select app.is_admin_scope())
  or student_id in (select app.my_owned_students())
  or section_id in (select app.my_taught_sections())
);
create policy mreport_write on public.monthly_report for all to authenticated
  using ((select app.is_admin_scope()) or section_id in (select app.my_ct_sections()))
  with check ((select app.is_admin_scope()) or section_id in (select app.my_ct_sections()));

-- slippage flags — staff in scope only, never owners --------------------------
create policy slippage_read on public.slippage_flag for select to authenticated using (
  (select app.is_admin_scope()) or section_id in (select app.my_taught_sections())
);

-- guardian / links ------------------------------------------------------------
create policy guardian_read on public.guardian for select to authenticated using (
  (select app.is_admin_scope())
  or id = (select app.my_guardian_id())
  or exists (select 1 from public.guardian_student gs
             where gs.guardian_id = guardian.id and gs.student_id in (select app.my_scope_students()))
);
create policy gs_read on public.guardian_student for select to authenticated using (
  (select app.is_admin_scope())
  or student_id in (select app.my_owned_students())
  or student_id in (select app.my_scope_students())
);
