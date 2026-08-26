-- =============================================================================
-- Migration 0011
--   1. Principal/office may NOT enter marks (no teaching entry) — keep read for
--      analytics. Leave applications become class-teacher-only (+ the applicant);
--      principal/office no longer see or decide them.
--   2. Class-level analytics RPC (whole class = all its sections).
-- =============================================================================

-- 1a. Marks: remove blanket admin write. Only the class teacher of the student's
--     current section or the subject teacher of that section×subject may write.
drop policy if exists mark_write on public.mark;
create policy mark_write on public.mark for all to authenticated
  using (
    student_id in (select app.my_ct_students())
    or exists (select 1 from public.assessment a where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  ) with check (
    student_id in (select app.my_ct_students())
    or exists (select 1 from public.assessment a where a.id = mark.assessment_id
               and (a.section_id, a.subject_id) in (select section_id, subject_id from app.my_allot_pairs()))
  );

-- 1b. Leave: class teacher (of the section) + the applying guardian only.
drop policy if exists leave_read on public.leave_application;
create policy leave_read on public.leave_application for select to authenticated using (
  app.owns_student(student_id) or app.ct_of_section(section_id, academic_year_id)
);
drop policy if exists leave_decide on public.leave_application;
create policy leave_decide on public.leave_application for update to authenticated using (
  app.ct_of_section(section_id, academic_year_id)
) with check (
  app.ct_of_section(section_id, academic_year_id)
);

-- ---------------------------------------------------------------------------
-- 2. Class-level analytics (aggregate across all sections of a class).
--    SECURITY INVOKER — RLS scopes rows (principal sees all; a teacher only
--    the sections they teach).
-- ---------------------------------------------------------------------------
create or replace function public.top_performers_class(
  p_class bigint, p_year bigint, p_subject bigint default null, p_limit int default 5)
returns table(student_id bigint, student_name text, section_name text, avg_percent numeric, n_marks bigint)
language sql stable security invoker set search_path = public as $$
  select student_id, student_name, section_name, round(avg(percent), 2), count(*)
  from public.v_mark_detail
  where class_id = p_class and academic_year_id = p_year
    and is_numeric and marks_obtained is not null
    and (p_subject is null or subject_id = p_subject)
  group by student_id, student_name, section_name
  order by 4 desc
  limit p_limit;
$$;

create or replace function public.needs_support_class(
  p_class bigint, p_year bigint, p_threshold numeric default 40)
returns table(
  student_id bigint, student_name text, section_name text, avg_percent numeric,
  weak_subjects text, recent_trend numeric, reason text)
language sql stable security invoker set search_path = public as $$
  with per_student as (
    select student_id, student_name, section_name, round(avg(percent), 2) as avg_percent
    from public.v_mark_detail
    where class_id = p_class and academic_year_id = p_year and is_numeric and marks_obtained is not null
    group by student_id, student_name, section_name
  ),
  weak as (
    select student_id, string_agg(distinct subject_name, ', ' order by subject_name) as weak_subjects
    from public.v_mark_detail
    where class_id = p_class and academic_year_id = p_year and is_numeric and marks_obtained is not null
    group by student_id, subject_id, subject_name
    having avg(percent) < p_threshold
  ),
  trend as (
    select student_id, round(sum(delta), 2) as recent_trend
    from (
      select student_id, delta,
             row_number() over (partition by student_id order by assessed_on desc, assessment_id desc) rn
      from public.v_student_subject_trend
      where class_id = p_class and academic_year_id = p_year and delta is not null
    ) t where rn <= 3
    group by student_id
  )
  select ps.student_id, ps.student_name, ps.section_name, ps.avg_percent,
         w.weak_subjects, coalesce(t.recent_trend, 0),
         trim(both '; ' from concat_ws('; ',
           case when ps.avg_percent < p_threshold then 'overall ' || ps.avg_percent || '%' end,
           case when w.weak_subjects is not null then 'weak in ' || w.weak_subjects end,
           case when coalesce(t.recent_trend, 0) < 0 then 'trending down ' || t.recent_trend || ' pts' end))
  from per_student ps
  left join weak w on w.student_id = ps.student_id
  left join trend t on t.student_id = ps.student_id
  where ps.avg_percent < p_threshold or w.weak_subjects is not null or coalesce(t.recent_trend, 0) < -5
  order by ps.avg_percent asc;
$$;

grant execute on function public.top_performers_class(bigint, bigint, bigint, int) to authenticated, service_role;
grant execute on function public.needs_support_class(bigint, bigint, numeric) to authenticated, service_role;
