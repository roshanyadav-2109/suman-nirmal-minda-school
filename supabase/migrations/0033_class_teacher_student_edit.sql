-- =============================================================================
-- Migration 0033 — Class teachers may correct their own pupils' details
--
-- A class teacher may UPDATE, for students enrolled this academic year in a
-- section they class-teach (app.my_ct_students / app.my_ct_sections, 0004):
--   * student           — name, date of birth, gender (NOT admission no, NOT
--                         the status / left_on / exit_remark the office keeps)
--   * guardian          — the parents linked to those students
--   * guardian_student  — the link's is_primary flag (NOT which guardian or
--                         student it links)
--   * student_enrollment— this year's roll_no only (NOT section, year, status)
--
-- RLS cannot limit which COLUMNS change, so a small BEFORE UPDATE guard on
-- each table refuses any other column change by a signed-in user who is not
-- office/principal. Office/principal (app.is_admin_scope) and background jobs
-- (no signed-in user) are untouched. No INSERT or DELETE is granted.
--
-- The existing *_admin_write policies (0002) still cover office/principal;
-- these new policies are permissive and simply OR in the class-teacher case.
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
drop policy if exists student_ct_update on public.student;
create policy student_ct_update on public.student
  for update to authenticated
  using      (id in (select app.my_ct_students()))
  with check (id in (select app.my_ct_students()));

drop policy if exists guardian_ct_update on public.guardian;
create policy guardian_ct_update on public.guardian
  for update to authenticated
  using (exists (
    select 1 from public.guardian_student gs
    where gs.guardian_id = guardian.id and gs.student_id in (select app.my_ct_students())
  ))
  with check (exists (
    select 1 from public.guardian_student gs
    where gs.guardian_id = guardian.id and gs.student_id in (select app.my_ct_students())
  ));

drop policy if exists gs_ct_update on public.guardian_student;
create policy gs_ct_update on public.guardian_student
  for update to authenticated
  using      (student_id in (select app.my_ct_students()))
  with check (student_id in (select app.my_ct_students()));

drop policy if exists enroll_ct_update on public.student_enrollment;
create policy enroll_ct_update on public.student_enrollment
  for update to authenticated
  using (
    academic_year_id = (select app.current_year_id())
    and section_id in (select app.my_ct_sections())
  )
  with check (
    academic_year_id = (select app.current_year_id())
    and section_id in (select app.my_ct_sections())
  );

-- ---------------------------------------------------------------------------
-- Column guards (apply only to signed-in users outside office/principal)
-- ---------------------------------------------------------------------------
create or replace function app.ct_edit_restricted()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and not app.is_admin_scope();
$$;

create or replace function app.guard_student_ct_update()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if app.ct_edit_restricted() and (
       new.id           is distinct from old.id
    or new.admission_no is distinct from old.admission_no
    or new.status       is distinct from old.status
    or new.left_on      is distinct from old.left_on
    or new.exit_remark  is distinct from old.exit_remark
    or new.created_at   is distinct from old.created_at
  ) then
    raise exception 'Only the school office can change the admission number or school status'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.guard_enrollment_ct_update()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if app.ct_edit_restricted() and (
       new.id               is distinct from old.id
    or new.student_id       is distinct from old.student_id
    or new.academic_year_id is distinct from old.academic_year_id
    or new.section_id       is distinct from old.section_id
    or new.status           is distinct from old.status
    or new.created_at       is distinct from old.created_at
  ) then
    raise exception 'A class teacher may change only the roll number of an enrollment'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.guard_gs_ct_update()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if app.ct_edit_restricted() and (
       new.guardian_id is distinct from old.guardian_id
    or new.student_id  is distinct from old.student_id
  ) then
    raise exception 'Only the school office can link a different parent or student'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_student_ct_guard on public.student;
create trigger trg_student_ct_guard before update on public.student
  for each row execute function app.guard_student_ct_update();

drop trigger if exists trg_enrollment_ct_guard on public.student_enrollment;
create trigger trg_enrollment_ct_guard before update on public.student_enrollment
  for each row execute function app.guard_enrollment_ct_update();

drop trigger if exists trg_gs_ct_guard on public.guardian_student;
create trigger trg_gs_ct_guard before update on public.guardian_student
  for each row execute function app.guard_gs_ct_update();

grant execute on function app.ct_edit_restricted() to authenticated, anon, service_role;
grant execute on function app.guard_student_ct_update() to authenticated, service_role;
grant execute on function app.guard_enrollment_ct_update() to authenticated, service_role;
grant execute on function app.guard_gs_ct_update() to authenticated, service_role;
