-- =============================================================================
-- Migration 0014 — Dashboard overview RPCs (RLS-scoped, SECURITY INVOKER).
-- Used by the principal & office dashboards. A teacher calling these would see
-- only their scoped rows; principal/office see the whole school.
-- =============================================================================
create or replace function public.school_overview(p_year bigint)
returns table(students bigint, avg_percent numeric, attendance_pct numeric, slippage bigint)
language sql stable security invoker set search_path = public as $$
  select
    (select count(distinct student_id) from public.student_enrollment where academic_year_id = p_year),
    (select round(avg(percent), 1) from public.v_mark_detail
       where academic_year_id = p_year and is_numeric and marks_obtained is not null),
    (select round(100.0 * count(*) filter (where status in ('present','late')) / nullif(count(*), 0), 1)
       from public.attendance_record where academic_year_id = p_year and period is null),
    (select count(*) from public.slippage_flag where is_active and academic_year_id = p_year);
$$;

create or replace function public.class_overview(p_year bigint)
returns table(class_id bigint, class_name text, class_level smallint, avg_percent numeric, students bigint)
language sql stable security invoker set search_path = public as $$
  select class_id, class_name, class_level::smallint, round(avg(percent), 1), count(distinct student_id)
  from public.v_mark_detail
  where academic_year_id = p_year and is_numeric and marks_obtained is not null
  group by class_id, class_name, class_level
  order by class_level;
$$;

grant execute on function public.school_overview(bigint) to authenticated, service_role;
grant execute on function public.class_overview(bigint) to authenticated, service_role;
