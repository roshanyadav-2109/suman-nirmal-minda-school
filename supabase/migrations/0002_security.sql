-- =============================================================================
-- Migration 0002 — Security: allotment-aware helpers + RLS on every table
-- RLS is the security boundary (brief §6, §10). Policies mirror the role table
-- in §1 by joining against teacher_allotment. Helpers live in a private `app`
-- schema (not exposed to PostgREST) and are SECURITY DEFINER so they read base
-- tables without triggering recursive RLS.
-- =============================================================================

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Identity / role helpers
-- ---------------------------------------------------------------------------
create or replace function app.current_year_id()
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.academic_year where is_current limit 1;
$$;

create or replace function app.my_role()
returns profile_role language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profile where id = auth.uid();
$$;

create or replace function app.my_staff_id()
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select staff_id from public.profile where id = auth.uid();
$$;

create or replace function app.my_guardian_id()
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select guardian_id from public.profile where id = auth.uid();
$$;

create or replace function app.my_staff_role()
returns staff_role language sql stable security definer set search_path = public, pg_temp as $$
  select s.role from public.profile p join public.staff s on s.id = p.staff_id
  where p.id = auth.uid();
$$;

create or replace function app.is_admin_scope()   -- principal + office = unrestricted
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(app.my_staff_role() in ('principal','office'), false);
$$;

create or replace function app.is_principal()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(app.my_staff_role() = 'principal', false);
$$;

-- Student ids this user owns: a student sees self; a guardian sees their children.
create or replace function app.owns_student(p_student bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profile pr where pr.id = auth.uid()
      and pr.role = 'student' and pr.student_id = p_student
  ) or exists (
    select 1 from public.profile pr
      join public.guardian_student gs on gs.guardian_id = pr.guardian_id
    where pr.id = auth.uid() and pr.role = 'guardian' and gs.student_id = p_student
  );
$$;

-- A student's section in a given year (defaults to the current year).
create or replace function app.student_section(p_student bigint, p_year bigint default null)
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select e.section_id from public.student_enrollment e
  where e.student_id = p_student
    and e.academic_year_id = coalesce(p_year, app.current_year_id())
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Allotment-driven scope helpers (the core of the access model)
-- ---------------------------------------------------------------------------
create or replace function app.teaches_section(p_section bigint, p_year bigint default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.teacher_allotment a
    where a.staff_id = app.my_staff_id()
      and a.section_id = p_section
      and a.academic_year_id = coalesce(p_year, app.current_year_id())
  );
$$;

create or replace function app.ct_of_section(p_section bigint, p_year bigint default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.teacher_allotment a
    where a.staff_id = app.my_staff_id()
      and a.section_id = p_section
      and a.is_class_teacher
      and a.academic_year_id = coalesce(p_year, app.current_year_id())
  );
$$;

-- Class teacher teaches every subject in their section; subject teacher only theirs.
create or replace function app.teaches_subject(p_section bigint, p_subject bigint, p_year bigint default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.teacher_allotment a
    where a.staff_id = app.my_staff_id()
      and a.section_id = p_section
      and a.academic_year_id = coalesce(p_year, app.current_year_id())
      and (a.is_class_teacher or a.subject_id = p_subject)
  );
$$;

-- Can the caller see this student at all (roster/profile/attendance level)?
create or replace function app.can_view_student(p_student bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_admin_scope()
      or app.owns_student(p_student)
      or app.teaches_section(app.student_section(p_student));
$$;

-- Can the caller see this student's marks/record for a given subject?
create or replace function app.can_view_student_subject(p_student bigint, p_subject bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_admin_scope()
      or app.owns_student(p_student)
      or app.teaches_subject(app.student_section(p_student), p_subject);
$$;

-- Write scope: staff who may enter marks for this student's subject (no owner).
create or replace function app.can_manage_student_subject(p_student bigint, p_subject bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_admin_scope()
      or app.teaches_subject(app.student_section(p_student), p_subject);
$$;

-- Visibility of a section-scoped or class-scoped broadcast to the caller.
create or replace function app.sees_section(p_section bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_admin_scope()
      or app.teaches_section(p_section)
      or exists (
        select 1 from public.student_enrollment e
        where e.section_id = p_section
          and e.academic_year_id = app.current_year_id()
          and app.owns_student(e.student_id)
      );
$$;

create or replace function app.sees_class(p_class bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_admin_scope()
      or exists (
        select 1 from public.teacher_allotment a
          join public.section s on s.id = a.section_id
        where a.staff_id = app.my_staff_id()
          and s.class_id = p_class
          and a.academic_year_id = app.current_year_id()
      )
      or exists (
        select 1 from public.student_enrollment e
          join public.section s on s.id = e.section_id
        where s.class_id = p_class
          and e.academic_year_id = app.current_year_id()
          and app.owns_student(e.student_id)
      );
$$;

grant execute on all functions in schema app to authenticated, anon, service_role;

-- ===========================================================================
-- Enable RLS everywhere
-- ===========================================================================
alter table public.school             enable row level security;
alter table public.academic_year      enable row level security;
alter table public.class              enable row level security;
alter table public.section            enable row level security;
alter table public.subject            enable row level security;
alter table public.class_subject      enable row level security;
alter table public.staff              enable row level security;
alter table public.student            enable row level security;
alter table public.guardian           enable row level security;
alter table public.guardian_student   enable row level security;
alter table public.profile            enable row level security;
alter table public.student_enrollment enable row level security;
alter table public.teacher_allotment  enable row level security;
alter table public.assessment_type    enable row level security;
alter table public.assessment         enable row level security;
alter table public.mark               enable row level security;
alter table public.attendance_record  enable row level security;
alter table public.observation        enable row level security;
alter table public.hpc_input          enable row level security;
alter table public.announcement       enable row level security;
alter table public.event              enable row level security;
alter table public.leave_application  enable row level security;
alter table public.feedback           enable row level security;
alter table public.monthly_report     enable row level security;
alter table public.slippage_flag      enable row level security;

-- ===========================================================================
-- Reference / structural tables — readable by any authenticated user,
-- writable only by office/principal.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['school','academic_year','class','section','subject',
                           'class_subject','assessment_type']
  loop
    execute format($f$
      create policy %1$s_read on public.%1$s
        for select to authenticated using (true);
      create policy %1$s_write on public.%1$s
        for all to authenticated
        using (app.is_admin_scope()) with check (app.is_admin_scope());
    $f$, t);
  end loop;
end $$;

-- staff directory: names/roles are non-sensitive and shown as "entered by".
create policy staff_read on public.staff for select to authenticated using (true);
create policy staff_write on public.staff for all to authenticated
  using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- profile
-- ===========================================================================
create policy profile_self_read on public.profile
  for select to authenticated using (id = auth.uid() or app.is_admin_scope());
create policy profile_self_update on public.profile
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profile_admin_write on public.profile
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- People: student / guardian / links
-- ===========================================================================
create policy student_read on public.student
  for select to authenticated using (app.can_view_student(id));
create policy student_admin_write on public.student
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

create policy guardian_read on public.guardian
  for select to authenticated using (
    app.is_admin_scope()
    or id = app.my_guardian_id()
    or exists (select 1 from public.guardian_student gs
               where gs.guardian_id = guardian.id and app.can_view_student(gs.student_id))
  );
create policy guardian_admin_write on public.guardian
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

create policy gs_read on public.guardian_student
  for select to authenticated using (
    app.is_admin_scope() or app.owns_student(student_id) or app.can_view_student(student_id)
  );
create policy gs_admin_write on public.guardian_student
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- Enrollment & allotment
-- ===========================================================================
create policy enroll_read on public.student_enrollment
  for select to authenticated using (app.can_view_student(student_id));
create policy enroll_admin_write on public.student_enrollment
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- Teachers may read their own allotments; admins read all.
create policy allot_read on public.teacher_allotment
  for select to authenticated using (app.is_admin_scope() or staff_id = app.my_staff_id());
create policy allot_admin_write on public.teacher_allotment
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- Assessment & marks
-- ===========================================================================
create policy assessment_read on public.assessment
  for select to authenticated using (
    app.is_admin_scope()
    or app.teaches_subject(section_id, subject_id, academic_year_id)
    or app.sees_section(section_id)          -- students/guardians see their section's assessments
  );
create policy assessment_write on public.assessment
  for all to authenticated using (
    app.is_admin_scope() or app.teaches_subject(section_id, subject_id, academic_year_id)
  ) with check (
    app.is_admin_scope() or app.teaches_subject(section_id, subject_id, academic_year_id)
  );

create policy mark_read on public.mark
  for select to authenticated using (
    app.owns_student(student_id)
    or exists (select 1 from public.assessment a where a.id = assessment_id
               and app.can_view_student_subject(mark.student_id, a.subject_id))
  );
create policy mark_write on public.mark
  for all to authenticated using (
    exists (select 1 from public.assessment a where a.id = assessment_id
            and app.can_manage_student_subject(mark.student_id, a.subject_id))
  ) with check (
    exists (select 1 from public.assessment a where a.id = assessment_id
            and app.can_manage_student_subject(mark.student_id, a.subject_id))
  );

-- ===========================================================================
-- Attendance
-- ===========================================================================
create policy attendance_read on public.attendance_record
  for select to authenticated using (
    app.owns_student(student_id) or app.is_admin_scope() or app.teaches_section(section_id, academic_year_id)
  );
create policy attendance_write on public.attendance_record
  for all to authenticated using (
    app.is_admin_scope() or app.teaches_section(section_id, academic_year_id)
  ) with check (
    app.is_admin_scope() or app.teaches_section(section_id, academic_year_id)
  );

-- ===========================================================================
-- Observations & HPC inputs
-- ===========================================================================
create policy observation_read on public.observation
  for select to authenticated using (
    app.is_admin_scope()
    or app.can_view_student(student_id)
    or (visible_to_guardian and app.owns_student(student_id))
  );
create policy observation_write on public.observation
  for all to authenticated using (
    app.is_admin_scope() or (staff_id = app.my_staff_id() and app.can_view_student(student_id))
  ) with check (
    app.is_admin_scope() or (staff_id = app.my_staff_id() and app.can_view_student(student_id))
  );

create policy hpc_read on public.hpc_input
  for select to authenticated using (
    app.is_admin_scope() or app.can_view_student(student_id) or app.owns_student(student_id)
  );
create policy hpc_write on public.hpc_input
  for all to authenticated using (
    submitted_by = auth.uid() and (app.owns_student(student_id) or app.can_view_student(student_id))
  ) with check (
    submitted_by = auth.uid() and (app.owns_student(student_id) or app.can_view_student(student_id))
  );

-- ===========================================================================
-- Communication
-- ===========================================================================
create policy announcement_read on public.announcement
  for select to authenticated using (
    scope = 'school'
    or (scope = 'class'   and app.sees_class(class_id))
    or (scope = 'section' and app.sees_section(section_id))
  );
create policy announcement_write on public.announcement
  for all to authenticated using (
    app.is_admin_scope() or created_by = app.my_staff_id()
  ) with check (
    app.is_admin_scope() or created_by = app.my_staff_id()
  );

create policy event_read on public.event
  for select to authenticated using (
    (class_id is null and section_id is null)                 -- school-wide
    or (class_id is not null and app.sees_class(class_id))
    or (section_id is not null and app.sees_section(section_id))
  );
create policy event_write on public.event
  for all to authenticated using (
    app.is_admin_scope() or created_by = app.my_staff_id()
  ) with check (
    app.is_admin_scope() or created_by = app.my_staff_id()
  );

-- Leave: guardian applies for own child; class teacher of the section decides.
create policy leave_read on public.leave_application
  for select to authenticated using (
    app.is_admin_scope() or app.owns_student(student_id) or app.ct_of_section(section_id, academic_year_id)
  );
create policy leave_insert on public.leave_application
  for insert to authenticated with check (
    applied_by = auth.uid() and app.owns_student(student_id)
  );
create policy leave_decide on public.leave_application
  for update to authenticated using (
    app.is_admin_scope() or app.ct_of_section(section_id, academic_year_id)
  ) with check (
    app.is_admin_scope() or app.ct_of_section(section_id, academic_year_id)
  );

-- Feedback: guardian sends for own child; class teacher + principal read/respond.
create policy feedback_read on public.feedback
  for select to authenticated using (
    app.is_admin_scope() or from_profile = auth.uid() or app.ct_of_section(section_id)
  );
create policy feedback_insert on public.feedback
  for insert to authenticated with check (
    from_profile = auth.uid() and app.owns_student(student_id)
  );
create policy feedback_respond on public.feedback
  for update to authenticated using (
    app.is_admin_scope() or app.ct_of_section(section_id)
  ) with check (
    app.is_admin_scope() or app.ct_of_section(section_id)
  );

-- ===========================================================================
-- Monthly report
-- ===========================================================================
create policy mreport_read on public.monthly_report
  for select to authenticated using (
    app.owns_student(student_id) or app.is_admin_scope() or app.teaches_section(section_id, academic_year_id)
  );
create policy mreport_write on public.monthly_report
  for all to authenticated using (
    app.is_admin_scope() or app.ct_of_section(section_id, academic_year_id)
  ) with check (
    app.is_admin_scope() or app.ct_of_section(section_id, academic_year_id)
  );

-- ===========================================================================
-- Slippage flags — STAFF IN SCOPE ONLY. Never students/guardians (§10).
-- No owner policy exists, so owners get zero rows.
-- ===========================================================================
create policy slippage_read on public.slippage_flag
  for select to authenticated using (
    app.is_admin_scope() or app.teaches_section(section_id, academic_year_id)
  );
create policy slippage_write on public.slippage_flag
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());
