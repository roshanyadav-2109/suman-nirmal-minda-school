-- Whole-school report in one query (principal / office only).
-- Per pupil enrolled in the year: average mark % and attendance counts over a
-- date range, or the average for one exam (p_exam, attendance then zero).
-- Replaces 92 per-section RPC calls that each re-checked row security.
-- Security definer so row checks are skipped; guarded by app.is_admin_scope(),
-- anyone else gets no rows.
create or replace function public.school_report_summary(
  p_year bigint, p_start date default null, p_end date default null, p_exam text default null)
returns table(student_id bigint, section_id bigint, avg_percent numeric, present bigint, total bigint)
language sql stable security definer set search_path = public as $$
  with m as (
    select mk.student_id,
           round(avg(mk.marks_obtained / nullif(a.max_marks, 0) * 100), 1) as avg_percent
    from public.mark mk
    join public.assessment a       on a.id  = mk.assessment_id
    join public.assessment_type at on at.id = a.assessment_type_id
    where a.academic_year_id = p_year and at.is_numeric and mk.marks_obtained is not null
      and (case when p_exam is not null then a.name = p_exam
                else a.assessed_on between p_start and p_end end)
    group by mk.student_id
  ),
  att as (
    select r.student_id, r.section_id,
           count(*) filter (where r.status in ('present', 'late')) as present,
           count(*) as total
    from public.attendance_record r
    where p_exam is null and r.period is null and r.on_date between p_start and p_end
    group by r.student_id, r.section_id
  )
  select e.student_id, e.section_id, m.avg_percent,
         coalesce(att.present, 0), coalesce(att.total, 0)
  from public.student_enrollment e
  left join m   on m.student_id = e.student_id
  left join att on att.student_id = e.student_id and att.section_id = e.section_id
  where e.academic_year_id = p_year and app.is_admin_scope();
$$;

revoke all on function public.school_report_summary(bigint, date, date, text) from public, anon;
grant execute on function public.school_report_summary(bigint, date, date, text) to authenticated, service_role;

notify pgrst, 'reload schema';
