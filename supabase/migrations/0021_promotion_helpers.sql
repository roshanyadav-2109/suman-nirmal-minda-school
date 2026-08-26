-- =============================================================================
-- Migration 0021 — read helpers for the office promotion console (admin-guarded
-- SECURITY DEFINER, so they run fast at full-school scale without per-row RLS).
-- =============================================================================

-- Classes with active-pupil counts and how many are already promoted to the target year.
create or replace function public.promotable_classes(p_from_year bigint, p_to_year bigint)
returns table(class_id bigint, class_name text, class_level smallint, students bigint, promoted bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app.is_admin_scope() then return; end if;
  return query
    select cl.id, cl.name, cl.level::smallint,
           count(distinct e.student_id),
           (select count(*) from public.promotion p
              join public.section fs on fs.id = p.from_section_id
              where fs.class_id = cl.id and p.to_year_id = p_to_year)
    from public.class cl
    join public.section s on s.class_id = cl.id
    join public.student_enrollment e on e.section_id = s.id and e.academic_year_id = p_from_year
    join public.student st on st.id = e.student_id and st.status = 'active'
    group by cl.id, cl.name, cl.level
    order by cl.level;
end $$;
grant execute on function public.promotable_classes(bigint, bigint) to authenticated, service_role;

-- Roster of one class in the source year, with any existing promotion decision.
create or replace function public.promotion_roster(p_from_year bigint, p_to_year bigint, p_class bigint)
returns table(student_id bigint, full_name text, roll_no smallint, section_id bigint, section_name text,
              status text, outcome text, to_section_id bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app.is_admin_scope() then return; end if;
  return query
    select st.id, st.full_name, e.roll_no, s.id, s.name, st.status, p.outcome, p.to_section_id
    from public.student_enrollment e
    join public.section s on s.id = e.section_id
    join public.student st on st.id = e.student_id
    left join public.promotion p on p.student_id = st.id and p.to_year_id = p_to_year
    where s.class_id = p_class and e.academic_year_id = p_from_year
    order by s.name, e.roll_no;
end $$;
grant execute on function public.promotion_roster(bigint, bigint, bigint) to authenticated, service_role;
