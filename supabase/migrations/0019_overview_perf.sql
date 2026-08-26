-- =============================================================================
-- Migration 0019 — Dashboard overview performance at real-school scale.
--   The 2024-25 seed has ~171k attendance rows and ~54k marks. school_overview
--   (4 aggregates incl. a full attendance scan + the v_mark_detail view) exceeded
--   the authenticated role's statement_timeout (57014) via PostgREST.
--   Fix: (1) index attendance by year/date, (2) recompute the overviews as
--   admin-guarded SECURITY DEFINER over base tables (mark+assessment), so they
--   run without per-row RLS overhead and finish well within the timeout.
-- =============================================================================

-- Attendance: year-scoped scans (school aggregate, overview date-range).
create index if not exists idx_att_year_date on public.attendance_record (academic_year_id, on_date) where period is null;
-- Marks avg by year (join from mark).
create index if not exists idx_assess_year on public.assessment (academic_year_id);

-- ---------------------------------------------------------------------------
-- school_overview — admin-only school-wide KPIs. SECURITY DEFINER + guard:
-- non-admins get zero rows (the app renders 0/—); principal & office get totals.
-- ---------------------------------------------------------------------------
create or replace function public.school_overview(p_year bigint)
returns table(students bigint, avg_percent numeric, attendance_pct numeric, slippage bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app.is_admin_scope() then return; end if;
  return query
    select
      (select count(*) from public.student_enrollment where academic_year_id = p_year),
      (select round(avg(100.0 * m.marks_obtained / a.max_marks), 1)
         from public.mark m join public.assessment a on a.id = m.assessment_id
         where a.academic_year_id = p_year and a.max_marks > 0 and m.marks_obtained is not null),
      (select round(100.0 * count(*) filter (where status in ('present','late')) / nullif(count(*), 0), 1)
         from public.attendance_record where academic_year_id = p_year and period is null),
      (select count(*) from public.slippage_flag where is_active and academic_year_id = p_year);
end $$;

-- ---------------------------------------------------------------------------
-- class_overview — admin-only per-class averages (whole class = all sections).
-- ---------------------------------------------------------------------------
create or replace function public.class_overview(p_year bigint)
returns table(class_id bigint, class_name text, class_level smallint, avg_percent numeric, students bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app.is_admin_scope() then return; end if;
  return query
    select cl.id, cl.name, cl.level::smallint,
           round(avg(100.0 * m.marks_obtained / a.max_marks), 1),
           count(distinct m.student_id)
    from public.mark m
    join public.assessment a on a.id = m.assessment_id
    join public.section sec on sec.id = a.section_id
    join public.class cl on cl.id = sec.class_id
    where a.academic_year_id = p_year and a.max_marks > 0 and m.marks_obtained is not null
    group by cl.id, cl.name, cl.level
    order by cl.level;
end $$;

grant execute on function public.school_overview(bigint) to authenticated, service_role;
grant execute on function public.class_overview(bigint) to authenticated, service_role;
