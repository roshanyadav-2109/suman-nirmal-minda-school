-- =============================================================================
-- Migration 0006 — Scheduled early-slippage computation (brief §2.1, §8)
-- Recomputes slippage_flag from the last N assessments per student×subject.
-- SECURITY DEFINER (owned by postgres) so it sees all data; the flags are then
-- read back under RLS (staff-in-scope only).
-- =============================================================================

create or replace function public.refresh_slippage_flags(p_window int default 3, p_threshold numeric default 8)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  cur_year bigint;
begin
  select id into cur_year from public.academic_year where is_current limit 1;

  delete from public.slippage_flag where academic_year_id = cur_year;

  with recent as (
    select t.student_id, t.subject_id, t.section_id, t.academic_year_id, t.delta,
           row_number() over (partition by t.student_id, t.subject_id
                              order by t.assessed_on desc, t.assessment_id desc) as rn
    from public.v_student_subject_trend t
    where t.academic_year_id = cur_year and t.delta is not null
  ),
  agg as (
    select student_id, subject_id, section_id, academic_year_id, round(sum(delta), 2) as trend
    from recent where rn <= p_window
    group by student_id, subject_id, section_id, academic_year_id
  )
  insert into public.slippage_flag
    (student_id, section_id, academic_year_id, subject_id, window_size, trend_delta, reason, is_active, computed_at)
  select student_id, section_id, academic_year_id, subject_id, p_window, trend,
         'Declining trend across the last ' || p_window || ' assessments (' || trend || ' pts).', true, now()
  from agg
  where trend <= -p_threshold
  on conflict (student_id, subject_id, academic_year_id)
  do update set trend_delta = excluded.trend_delta, reason = excluded.reason,
                computed_at = now(), is_active = true;

  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.refresh_slippage_flags(int, numeric) from public, anon, authenticated;
