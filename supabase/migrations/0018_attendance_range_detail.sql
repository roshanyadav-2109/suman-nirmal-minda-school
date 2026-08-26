-- =============================================================================
-- Migration 0018 — Attendance over a date range + per-student detail.
--   attendance_overview_range: aggregate present/total per section over [start,end]
--     (day = start==end; month = month bounds).
--   section_attendance_range: per-student present/total over [start,end] for the
--     principal's detailed drill-down.
-- Both SECURITY INVOKER (RLS-scoped).
-- =============================================================================
create or replace function public.attendance_overview_range(p_start date, p_end date, p_year bigint)
returns table(
  class_id bigint, class_name text, class_level smallint,
  section_id bigint, section_name text, present bigint, total bigint)
language sql stable security invoker set search_path = public as $$
  select cl.id, cl.name, cl.level::smallint, sec.id, sec.name,
         count(*) filter (where a.status in ('present','late')),
         count(*)
  from public.attendance_record a
  join public.section sec on sec.id = a.section_id
  join public.class cl on cl.id = sec.class_id
  where a.on_date between p_start and p_end and a.period is null and a.academic_year_id = p_year
  group by cl.id, cl.name, cl.level, sec.id, sec.name
  order by cl.level, sec.name;
$$;

create or replace function public.section_attendance_range(p_section bigint, p_start date, p_end date, p_year bigint)
returns table(student_id bigint, full_name text, roll_no smallint, present bigint, total bigint)
language sql stable security invoker set search_path = public as $$
  select st.id, st.full_name, e.roll_no,
         count(a.id) filter (where a.status in ('present','late')),
         count(a.id)
  from public.student_enrollment e
  join public.student st on st.id = e.student_id
  left join public.attendance_record a
    on a.student_id = e.student_id and a.section_id = p_section
    and a.period is null and a.on_date between p_start and p_end
  where e.section_id = p_section and e.academic_year_id = p_year
  group by st.id, st.full_name, e.roll_no
  order by e.roll_no;
$$;

grant execute on function public.attendance_overview_range(date, date, bigint) to authenticated, service_role;
grant execute on function public.section_attendance_range(bigint, date, date, bigint) to authenticated, service_role;
