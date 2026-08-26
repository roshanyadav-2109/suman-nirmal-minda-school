-- =============================================================================
-- Migration 0009 — Student features
--   1. student_standing() — class & section rank without exposing other pupils
--   2. absence_notice — auto-created when a class teacher marks a student absent;
--      the student/guardian fills the reason, the class teacher reads it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Class / section standing (rank). SECURITY DEFINER: ranks across all
-- students but returns ONLY the caller's rank + aggregate averages.
-- ---------------------------------------------------------------------------
create or replace function public.student_standing(p_student bigint, p_year bigint)
returns table(
  section_rank int, section_size int, class_rank int, class_size int,
  student_avg numeric, section_avg numeric, class_avg numeric)
language sql stable security definer set search_path = public as $$
  with per as (
    select student_id, section_id, class_id, avg(percent) as avg
    from public.v_mark_detail
    where academic_year_id = p_year and is_numeric and marks_obtained is not null
    group by student_id, section_id, class_id
  ),
  me as (select section_id, class_id from per where student_id = p_student limit 1),
  sec as (
    select student_id, rank() over (order by avg desc) as rnk, count(*) over () as cnt
    from per where section_id = (select section_id from me)
  ),
  cls as (
    select student_id, rank() over (order by avg desc) as rnk, count(*) over () as cnt
    from per where class_id = (select class_id from me)
  )
  select
    (select rnk from sec where student_id = p_student)::int,
    (select cnt from sec limit 1)::int,
    (select rnk from cls where student_id = p_student)::int,
    (select cnt from cls limit 1)::int,
    (select round(avg, 1) from per where student_id = p_student),
    (select round(avg(avg), 1) from per where section_id = (select section_id from me)),
    (select round(avg(avg), 1) from per where class_id = (select class_id from me));
$$;

-- Only a caller who can already see this student may ask for the standing.
create or replace function public.student_standing_guarded(p_student bigint, p_year bigint)
returns table(
  section_rank int, section_size int, class_rank int, class_size int,
  student_avg numeric, section_avg numeric, class_avg numeric)
language sql stable security invoker set search_path = public as $$
  -- RLS check: student row is visible to the caller (owner or staff-in-scope)
  select s.* from public.student_standing(p_student, p_year) s
  where exists (select 1 from public.student st where st.id = p_student);
$$;

revoke all on function public.student_standing(bigint, bigint) from public, anon, authenticated;
grant execute on function public.student_standing_guarded(bigint, bigint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Absence notices
-- ---------------------------------------------------------------------------
create table public.absence_notice (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  section_id       bigint not null references public.section(id),
  academic_year_id bigint not null references public.academic_year(id),
  on_date          date not null,
  reason           text,
  status           text not null default 'pending',   -- pending | explained
  explained_by     uuid references public.profile(id),
  explained_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (student_id, on_date)
);
create index idx_absence_section on public.absence_notice(section_id, status);
create index idx_absence_student on public.absence_notice(student_id);

alter table public.absence_notice enable row level security;

-- Owner (student/guardian) and staff-in-scope may read.
create policy absence_read on public.absence_notice for select to authenticated using (
  (select app.is_admin_scope())
  or student_id in (select app.my_owned_students())
  or section_id in (select app.my_taught_sections())
);
-- Owner fills the reason; staff-in-scope may also amend/close.
create policy absence_update on public.absence_notice for update to authenticated using (
  student_id in (select app.my_owned_students())
  or (select app.is_admin_scope())
  or section_id in (select app.my_taught_sections())
) with check (
  student_id in (select app.my_owned_students())
  or (select app.is_admin_scope())
  or section_id in (select app.my_taught_sections())
);

-- Auto-create / clear a notice whenever whole-day attendance is written.
-- SECURITY DEFINER so it bypasses RLS for the system-managed insert.
create or replace function public.on_attendance_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.period is null then
    if new.status = 'absent' then
      insert into public.absence_notice (student_id, section_id, academic_year_id, on_date)
      values (new.student_id, new.section_id, new.academic_year_id, new.on_date)
      on conflict (student_id, on_date) do nothing;
    else
      -- marked present/late/leave → drop any still-unexplained request
      delete from public.absence_notice
      where student_id = new.student_id and on_date = new.on_date and status = 'pending';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_attendance_absence on public.attendance_record;
create trigger trg_attendance_absence
  after insert or update on public.attendance_record
  for each row execute function public.on_attendance_change();
