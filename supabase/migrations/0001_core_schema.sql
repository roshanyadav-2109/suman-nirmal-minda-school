-- =============================================================================
-- KV IIT Kharagpur · Student Progress & School ERP
-- Migration 0001 — Core schema (tables, enums, constraints, indexes)
-- Backend: Supabase Postgres. RLS is added in 0002_security.sql.
-- All data is synthetic/demo. No real PII.
-- =============================================================================

create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "pg_trgm";          -- name search

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type profile_role        as enum ('student', 'guardian', 'staff');
create type staff_role          as enum ('subject_teacher', 'class_teacher', 'principal', 'office');
create type nep_stage           as enum ('foundational', 'preparatory', 'middle', 'senior');
create type attendance_status   as enum ('present', 'absent', 'late', 'leave', 'holiday');
create type leave_status        as enum ('pending', 'approved', 'rejected', 'cancelled');
create type announcement_scope  as enum ('school', 'class', 'section');
create type event_type          as enum ('holiday', 'exam', 'ptm', 'activity', 'other');
create type observation_category as enum ('strength', 'difficulty', 'progress', 'behaviour', 'general');
create type hpc_source          as enum ('self', 'peer', 'parent', 'teacher');
create type feedback_status     as enum ('new', 'read', 'responded');
create type gender_type         as enum ('male', 'female', 'other');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===========================================================================
-- Institution structure
-- ===========================================================================
create table public.school (
  id            bigint generated always as identity primary key,
  name          text not null,
  code          text unique,
  address       text,
  emblem_path   text,                       -- Supabase Storage path to official KV emblem
  created_at    timestamptz not null default now()
);

create table public.academic_year (
  id            bigint generated always as identity primary key,
  name          text not null unique,       -- e.g. '2024-25'
  start_date    date not null,
  end_date      date not null,
  is_current    boolean not null default false,
  created_at    timestamptz not null default now(),
  check (end_date > start_date)
);
-- Exactly one current year
create unique index one_current_year on public.academic_year ((is_current)) where is_current;

create table public.class (
  id            bigint generated always as identity primary key,
  name          text not null unique,       -- 'VI', 'VII', ...
  level         smallint not null unique,   -- 1..12, for ordering & progression
  stage         nep_stage not null,
  created_at    timestamptz not null default now()
);

create table public.section (
  id            bigint generated always as identity primary key,
  class_id      bigint not null references public.class(id) on delete cascade,
  name          text not null,              -- 'A', 'B', 'C'
  created_at    timestamptz not null default now(),
  unique (class_id, name)
);

create table public.subject (
  id            bigint generated always as identity primary key,
  name          text not null,              -- 'Mathematics'
  code          text not null unique,       -- 'MATH'
  created_at    timestamptz not null default now()
);

-- Which subjects a class studies (drives marks-entry pickers)
create table public.class_subject (
  class_id      bigint not null references public.class(id) on delete cascade,
  subject_id    bigint not null references public.subject(id) on delete cascade,
  primary key (class_id, subject_id)
);

-- ===========================================================================
-- People
-- ===========================================================================
create table public.staff (
  id            bigint generated always as identity primary key,
  employee_code text unique,
  full_name     text not null,
  role          staff_role not null,
  email         text,
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

create table public.student (
  id            bigint generated always as identity primary key,
  admission_no  text not null unique,       -- STABLE key: history spans years by this
  full_name     text not null,
  dob           date,
  gender        gender_type,
  photo_path    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_student_updated before update on public.student
  for each row execute function public.set_updated_at();

create table public.guardian (
  id            bigint generated always as identity primary key,
  full_name     text not null,
  relation      text,                       -- 'Father', 'Mother', 'Guardian'
  email         text,
  phone         text,
  created_at    timestamptz not null default now()
);

-- A guardian can have several children (siblings share the login); a student
-- can have several guardians.
create table public.guardian_student (
  guardian_id   bigint not null references public.guardian(id) on delete cascade,
  student_id    bigint not null references public.student(id) on delete cascade,
  is_primary    boolean not null default false,
  primary key (guardian_id, student_id)
);

-- Maps a Supabase Auth user -> a role and exactly one domain record.
create table public.profile (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          profile_role not null,
  full_name     text not null,
  locale        text not null default 'en',   -- 'en' | 'hi' | 'bn'
  staff_id      bigint unique references public.staff(id) on delete set null,
  guardian_id   bigint unique references public.guardian(id) on delete set null,
  student_id    bigint unique references public.student(id) on delete set null,
  created_at    timestamptz not null default now(),
  -- role must line up with exactly the matching link
  check (
    (role = 'staff'    and staff_id    is not null and guardian_id is null and student_id is null) or
    (role = 'guardian' and guardian_id is not null and staff_id    is null and student_id is null) or
    (role = 'student'  and student_id  is not null and staff_id    is null and guardian_id is null)
  )
);

-- ===========================================================================
-- Enrollment (per academic year) — this is what carries history across years
-- ===========================================================================
create table public.student_enrollment (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  academic_year_id bigint not null references public.academic_year(id) on delete cascade,
  section_id       bigint not null references public.section(id) on delete cascade,
  roll_no          smallint,
  status           text not null default 'active',  -- active | promoted | transferred
  created_at       timestamptz not null default now(),
  unique (student_id, academic_year_id)              -- one section per student per year
);
create index idx_enroll_student on public.student_enrollment(student_id);
create index idx_enroll_section_year on public.student_enrollment(section_id, academic_year_id);
create index idx_enroll_year on public.student_enrollment(academic_year_id);

-- ===========================================================================
-- Allotment — THE table that drives all RLS scoping
-- staff x section (x subject). is_class_teacher marks the class-teacher row.
-- A subject-teaching row has subject_id set; a class-teacher row may set
-- is_class_teacher=true (subject_id optional).
-- ===========================================================================
create table public.teacher_allotment (
  id               bigint generated always as identity primary key,
  staff_id         bigint not null references public.staff(id) on delete cascade,
  section_id       bigint not null references public.section(id) on delete cascade,
  subject_id       bigint references public.subject(id) on delete cascade,
  academic_year_id bigint not null references public.academic_year(id) on delete cascade,
  is_class_teacher boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (staff_id, section_id, subject_id, academic_year_id)
);
create index idx_allot_staff_year on public.teacher_allotment(staff_id, academic_year_id);
create index idx_allot_section_year on public.teacher_allotment(section_id, academic_year_id);
create index idx_allot_section_subject on public.teacher_allotment(section_id, subject_id, academic_year_id);
-- At most one class teacher per section per year
create unique index one_class_teacher_per_section
  on public.teacher_allotment(section_id, academic_year_id)
  where is_class_teacher;

-- ===========================================================================
-- Assessment & marks (CBSE pattern)
-- ===========================================================================
create table public.assessment_type (
  id          bigint generated always as identity primary key,
  code        text not null unique,   -- periodic_test, half_yearly, annual, notebook, enrichment, observation
  name        text not null,
  is_numeric  boolean not null default true,
  weightage   numeric(5,2)            -- CBSE weightage toward the term/board where relevant
);

create table public.assessment (
  id                 bigint generated always as identity primary key,
  assessment_type_id bigint not null references public.assessment_type(id),
  subject_id         bigint not null references public.subject(id),
  section_id         bigint not null references public.section(id) on delete cascade,
  academic_year_id   bigint not null references public.academic_year(id) on delete cascade,
  term               smallint,             -- 1 or 2 (CBSE two-term); null for standalone
  name               text not null,        -- 'Periodic Test 1', 'Half-Yearly', ...
  assessed_on        date not null,
  max_marks          numeric(6,2) not null default 100,
  created_by         bigint references public.staff(id),
  created_at         timestamptz not null default now()
);
create index idx_assess_section_year on public.assessment(section_id, academic_year_id);
create index idx_assess_subject on public.assessment(subject_id);
create index idx_assess_date on public.assessment(assessed_on);

create table public.mark (
  id             bigint generated always as identity primary key,
  assessment_id  bigint not null references public.assessment(id) on delete cascade,
  student_id     bigint not null references public.student(id) on delete cascade,
  marks_obtained numeric(6,2),          -- null = not-yet-entered / absent
  grade          text,                  -- for descriptive/competency assessments
  is_absent      boolean not null default false,
  remark         text,
  entered_by     bigint references public.staff(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (assessment_id, student_id)
);
create index idx_mark_student on public.mark(student_id);
create index idx_mark_assessment on public.mark(assessment_id);
create trigger trg_mark_updated before update on public.mark
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Attendance
-- ===========================================================================
create table public.attendance_record (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  section_id       bigint not null references public.section(id) on delete cascade,
  academic_year_id bigint not null references public.academic_year(id) on delete cascade,
  on_date          date not null,
  period           smallint,             -- null = whole-day (daily) attendance
  subject_id       bigint references public.subject(id),  -- set for period/subject-wise
  status           attendance_status not null,
  marked_by        bigint references public.staff(id),
  created_at       timestamptz not null default now(),
  -- one record per student per day per period-slot (null period = daily slot)
  unique (student_id, on_date, period)
);
create index idx_att_student_date on public.attendance_record(student_id, on_date);
create index idx_att_section_date on public.attendance_record(section_id, on_date);

-- ===========================================================================
-- Observations (teacher notes) + HPC-style multi-source inputs
-- ===========================================================================
create table public.observation (
  id                  bigint generated always as identity primary key,
  student_id          bigint not null references public.student(id) on delete cascade,
  staff_id            bigint not null references public.staff(id),
  academic_year_id    bigint not null references public.academic_year(id),
  subject_id          bigint references public.subject(id),   -- null = general/class-teacher
  category            observation_category not null default 'general',
  competency          text,                                   -- HPC competency label
  rating              smallint,                               -- 1..5 competency rating
  body                text not null,
  observed_on         date not null default current_date,
  visible_to_guardian boolean not null default false,         -- keep needs-support internal by default
  created_at          timestamptz not null default now()
);
create index idx_obs_student on public.observation(student_id);

-- HPC self / peer / parent / teacher inputs (school can grow into this)
create table public.hpc_input (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  academic_year_id bigint not null references public.academic_year(id),
  source           hpc_source not null,
  competency       text not null,
  rating           smallint,          -- 1..5
  note             text,
  submitted_by     uuid references public.profile(id),
  created_at       timestamptz not null default now()
);
create index idx_hpc_student on public.hpc_input(student_id);

-- ===========================================================================
-- Communication modules
-- ===========================================================================
create table public.announcement (
  id               bigint generated always as identity primary key,
  title            text not null,
  body             text not null,
  scope            announcement_scope not null default 'school',
  class_id         bigint references public.class(id) on delete cascade,
  section_id       bigint references public.section(id) on delete cascade,
  academic_year_id bigint references public.academic_year(id),
  created_by       bigint references public.staff(id),
  published_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  check (
    (scope = 'school'  and class_id is null and section_id is null) or
    (scope = 'class'   and class_id is not null and section_id is null) or
    (scope = 'section' and section_id is not null)
  )
);
create index idx_ann_scope on public.announcement(scope, section_id, class_id);

create table public.event (
  id                bigint generated always as identity primary key,
  title             text not null,
  description       text,
  event_type        event_type not null default 'activity',
  start_date        date not null,
  end_date          date,
  class_id          bigint references public.class(id) on delete cascade,
  section_id        bigint references public.section(id) on delete cascade,
  remind_before_days smallint not null default 1,
  academic_year_id  bigint references public.academic_year(id),
  created_by        bigint references public.staff(id),
  created_at        timestamptz not null default now()
);
create index idx_event_dates on public.event(start_date);

create table public.leave_application (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  section_id       bigint not null references public.section(id),  -- denormalized for RLS
  academic_year_id bigint not null references public.academic_year(id),
  applied_by       uuid references public.profile(id),             -- guardian profile
  from_date        date not null,
  to_date          date not null,
  reason           text not null,
  status           leave_status not null default 'pending',
  decided_by       bigint references public.staff(id),
  decided_at       timestamptz,
  decision_note    text,
  created_at       timestamptz not null default now(),
  check (to_date >= from_date)
);
create index idx_leave_section on public.leave_application(section_id, status);
create index idx_leave_student on public.leave_application(student_id);

create table public.feedback (
  id                bigint generated always as identity primary key,
  student_id        bigint not null references public.student(id) on delete cascade,
  section_id        bigint not null references public.section(id),  -- denormalized for RLS
  from_profile      uuid references public.profile(id),             -- guardian
  subject           text not null,
  body              text not null,
  related_announcement_id bigint references public.announcement(id) on delete set null,
  status            feedback_status not null default 'new',
  response          text,
  responded_by      bigint references public.staff(id),
  created_at        timestamptz not null default now()
);
create index idx_feedback_section on public.feedback(section_id, status);

create table public.monthly_report (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  section_id       bigint not null references public.section(id),
  academic_year_id bigint not null references public.academic_year(id),
  month            date not null,           -- first day of the month
  summary          jsonb,                   -- computed metrics snapshot
  pdf_path         text,                    -- Supabase Storage path
  emailed_at       timestamptz,
  generated_at     timestamptz not null default now(),
  unique (student_id, month)
);
create index idx_mreport_student on public.monthly_report(student_id);

-- ===========================================================================
-- Early academic-slippage flags (materialized by scheduled Edge Function)
-- ===========================================================================
create table public.slippage_flag (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  section_id       bigint not null references public.section(id),
  academic_year_id bigint not null references public.academic_year(id),
  subject_id       bigint references public.subject(id),   -- null = overall
  window_size      smallint not null default 3,
  trend_delta      numeric(6,2),            -- negative = declining
  reason           text,
  is_active        boolean not null default true,
  computed_at      timestamptz not null default now(),
  unique (student_id, subject_id, academic_year_id)
);
create index idx_slip_section on public.slippage_flag(section_id) where is_active;
