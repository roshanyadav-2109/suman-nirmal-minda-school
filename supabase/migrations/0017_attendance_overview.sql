-- =============================================================================
-- Migration 0017 — Attendance overview for principal/office.
-- Instead of the per-pupil marking board, admins see aggregate attendance:
-- students attended (present + late) per section, which the UI rolls up to
-- class-wise and school-wide totals. SECURITY INVOKER → RLS scopes rows
-- (principal/office see the whole school).
-- =============================================================================
create or replace function public.attendance_overview(p_date date, p_year bigint)
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
  where a.on_date = p_date and a.period is null and a.academic_year_id = p_year
  group by cl.id, cl.name, cl.level, sec.id, sec.name
  order by cl.level, sec.name;
$$;

grant execute on function public.attendance_overview(date, bigint) to authenticated, service_role;
