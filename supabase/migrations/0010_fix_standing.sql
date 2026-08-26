-- =============================================================================
-- Migration 0010 — Fix student_standing permissions
-- The 0009 wrapper was SECURITY INVOKER but called a SECURITY DEFINER function
-- the caller had no EXECUTE on → returned nothing. Collapse to one SECURITY
-- DEFINER function that does the access check itself via app.can_view_student.
-- =============================================================================
drop function if exists public.student_standing_guarded(bigint, bigint);
drop function if exists public.student_standing(bigint, bigint);

create or replace function public.student_standing(p_student bigint, p_year bigint)
returns table(
  section_rank int, section_size int, class_rank int, class_size int,
  student_avg numeric, section_avg numeric, class_avg numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  -- Only a caller who may already see this student gets a result.
  if not app.can_view_student(p_student) then
    return;
  end if;

  return query
  with per as (
    select v.student_id, v.section_id, v.class_id, avg(v.percent) as avg
    from public.v_mark_detail v
    where v.academic_year_id = p_year and v.is_numeric and v.marks_obtained is not null
    group by v.student_id, v.section_id, v.class_id
  ),
  me as (select section_id, class_id from per where student_id = p_student limit 1),
  sec as (
    select p.student_id, rank() over (order by p.avg desc) as rnk, count(*) over () as cnt
    from per p where p.section_id = (select section_id from me)
  ),
  cls as (
    select p.student_id, rank() over (order by p.avg desc) as rnk, count(*) over () as cnt
    from per p where p.class_id = (select class_id from me)
  )
  select
    (select rnk from sec where student_id = p_student)::int,
    (select cnt from sec limit 1)::int,
    (select rnk from cls where student_id = p_student)::int,
    (select cnt from cls limit 1)::int,
    (select round(avg, 1) from per where student_id = p_student),
    (select round(avg(avg), 1) from per where section_id = (select section_id from me)),
    (select round(avg(avg), 1) from per where class_id = (select class_id from me));
end $$;

grant execute on function public.student_standing(bigint, bigint) to authenticated, service_role;
