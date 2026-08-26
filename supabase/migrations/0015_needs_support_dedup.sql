-- =============================================================================
-- Migration 0015 — Fix needs_support / needs_support_class duplicate rows.
-- The `weak` CTE grouped by (student_id, subject_id, subject_name), so a pupil
-- weak in N subjects produced N rows (each naming one subject) and the outer
-- join duplicated that pupil N times, also inflating "N students need support"
-- counts. Aggregate weak subjects to ONE row per student.
-- =============================================================================
create or replace function public.needs_support(
  p_section bigint, p_year bigint, p_threshold numeric default 40)
returns table(
  student_id bigint, student_name text, avg_percent numeric,
  weak_subjects text, recent_trend numeric, reason text)
language sql stable security invoker set search_path = public as $$
  with per_student as (
    select student_id, student_name, round(avg(percent), 2) as avg_percent
    from public.v_mark_detail
    where section_id = p_section and academic_year_id = p_year and is_numeric and marks_obtained is not null
    group by student_id, student_name
  ),
  weak as (
    select student_id, string_agg(subject_name, ', ' order by subject_name) as weak_subjects
    from (
      select student_id, subject_id, subject_name
      from public.v_mark_detail
      where section_id = p_section and academic_year_id = p_year and is_numeric and marks_obtained is not null
      group by student_id, subject_id, subject_name
      having avg(percent) < p_threshold
    ) s
    group by student_id
  ),
  trend as (
    select student_id, round(sum(delta), 2) as recent_trend
    from (
      select student_id, delta,
             row_number() over (partition by student_id order by assessed_on desc, assessment_id desc) rn
      from public.v_student_subject_trend
      where section_id = p_section and academic_year_id = p_year and delta is not null
    ) t where rn <= 3
    group by student_id
  )
  select ps.student_id, ps.student_name, ps.avg_percent,
         w.weak_subjects, coalesce(t.recent_trend, 0),
         trim(both '; ' from concat_ws('; ',
           case when ps.avg_percent < p_threshold then 'overall average ' || ps.avg_percent || '%' end,
           case when w.weak_subjects is not null then 'weak in ' || w.weak_subjects end,
           case when coalesce(t.recent_trend, 0) < 0 then 'trending down ' || t.recent_trend || ' pts recently' end))
  from per_student ps
  left join weak w on w.student_id = ps.student_id
  left join trend t on t.student_id = ps.student_id
  where ps.avg_percent < p_threshold or w.weak_subjects is not null or coalesce(t.recent_trend, 0) < -5
  order by ps.avg_percent asc;
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
    select student_id, string_agg(subject_name, ', ' order by subject_name) as weak_subjects
    from (
      select student_id, subject_id, subject_name
      from public.v_mark_detail
      where class_id = p_class and academic_year_id = p_year and is_numeric and marks_obtained is not null
      group by student_id, subject_id, subject_name
      having avg(percent) < p_threshold
    ) s
    group by student_id
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
