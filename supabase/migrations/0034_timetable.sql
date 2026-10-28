-- =============================================================================
-- Migration 0034 — Weekly timetable
--   timetable_period : the school's bell schedule (one row per period of the day)
--   timetable_slot   : what a section has in a given day + period, and who takes it
--
-- Read access
--   * period : every signed-in user
--   * slot   : principal/office (everything); a teacher sees every slot they take
--              plus every slot of a section they are allotted to this year; a
--              student/guardian sees their own (child's) section this year.
--              Same meaning as app.sees_section(section_id), but written with a
--              set-returning helper so the check runs once per query, not per row
--              (see 0004_rls_performance.sql).
-- Write access: principal/office only (app.is_admin_scope()).
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Bell schedule
-- ---------------------------------------------------------------------------
create table if not exists public.timetable_period (
  id          bigint generated always as identity primary key,
  period_no   smallint not null unique check (period_no between 1 and 20),
  label       text not null,
  start_time  time not null,
  end_time    time not null,
  is_break    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- Timetable cells
-- ---------------------------------------------------------------------------
create table if not exists public.timetable_slot (
  id               bigint generated always as identity primary key,
  academic_year_id bigint not null references public.academic_year(id) on delete cascade,
  section_id       bigint not null references public.section(id) on delete cascade,
  day_of_week      smallint not null check (day_of_week between 1 and 6),  -- 1 = Mon .. 6 = Sat
  period_no        smallint not null
                     references public.timetable_period(period_no) on update cascade on delete cascade,
  subject_id       bigint references public.subject(id) on delete set null,
  staff_id         bigint references public.staff(id) on delete set null,
  room             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (academic_year_id, section_id, day_of_week, period_no)
);

create index if not exists idx_tt_slot_staff_year   on public.timetable_slot(staff_id, academic_year_id);
create index if not exists idx_tt_slot_section_year on public.timetable_slot(section_id, academic_year_id);

drop trigger if exists trg_timetable_slot_updated on public.timetable_slot;
create trigger trg_timetable_slot_updated before update on public.timetable_slot
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: sections whose timetable the caller may read (this year)
--   taught sections (any allotment) ∪ sections of the caller's own students.
-- ---------------------------------------------------------------------------
create or replace function app.my_timetable_sections()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select app.my_taught_sections()
  union
  select e.section_id from public.student_enrollment e
  where e.academic_year_id = app.current_year_id()
    and e.student_id in (select app.my_owned_students());
$$;
grant execute on function app.my_timetable_sections() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.timetable_period enable row level security;
alter table public.timetable_slot   enable row level security;

drop policy if exists timetable_period_read  on public.timetable_period;
drop policy if exists timetable_period_write on public.timetable_period;
create policy timetable_period_read on public.timetable_period
  for select to authenticated using (true);
create policy timetable_period_write on public.timetable_period
  for all to authenticated
  using ((select app.is_admin_scope())) with check ((select app.is_admin_scope()));

drop policy if exists timetable_slot_read  on public.timetable_slot;
drop policy if exists timetable_slot_write on public.timetable_slot;
create policy timetable_slot_read on public.timetable_slot
  for select to authenticated using (
    (select app.is_admin_scope())
    or staff_id = (select app.my_staff_id())
    or section_id in (select app.my_timetable_sections())
  );
create policy timetable_slot_write on public.timetable_slot
  for all to authenticated
  using ((select app.is_admin_scope())) with check ((select app.is_admin_scope()));

grant select, insert, update, delete on public.timetable_period to authenticated;
grant select, insert, update, delete on public.timetable_slot   to authenticated;

-- ---------------------------------------------------------------------------
-- Default bell schedule (08:00 – 14:00). The office can change it from the
-- Schedule page; existing rows are never overwritten.
-- ---------------------------------------------------------------------------
insert into public.timetable_period (period_no, label, start_time, end_time, is_break) values
  (1,  'Period 1',    '08:00', '08:40', false),
  (2,  'Period 2',    '08:40', '09:20', false),
  (3,  'Period 3',    '09:20', '10:00', false),
  (4,  'Short break', '10:00', '10:15', true),
  (5,  'Period 4',    '10:15', '10:55', false),
  (6,  'Period 5',    '10:55', '11:35', false),
  (7,  'Lunch',       '11:35', '12:05', true),
  (8,  'Period 6',    '12:05', '12:45', false),
  (9,  'Period 7',    '12:45', '13:25', false),
  (10, 'Period 8',    '13:25', '14:00', false)
on conflict (period_no) do nothing;

notify pgrst, 'reload schema';
