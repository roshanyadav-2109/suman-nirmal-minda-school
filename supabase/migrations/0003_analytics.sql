-- =============================================================================
-- Migration 0003 — Analytics: RLS-aware views + RPC
-- All views use security_invoker=true and all functions are SECURITY INVOKER,
-- so they run under the caller's RLS. The SAME query returns correctly scoped
-- results per user: a subject teacher sees only their subject/sections; a
-- guardian sees only their child; the principal sees everything.
-- =============================================================================

-- CBSE-style scholastic grade band from a percentage.
create or replace function public.grade_band(pct numeric)
returns text language sql immutable as $$
  select case
    when pct is null then null
    when pct >= 91 then 'A1'  when pct >= 81 then 'A2'
    when pct >= 71 then 'B1'  when pct >= 61 then 'B2'
    when pct >= 51 then 'C1'  when pct >= 41 then 'C2'
    when pct >= 33 then 'D'   else 'E'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Base fact view: one row per entered numeric mark, fully labelled.
-- ---------------------------------------------------------------------------
create view public.v_mark_detail with (security_invoker = true) as
  select
    m.id                                                 as mark_id,
    m.student_id,
    st.full_name                                         as student_name,
    a.id                                                 as assessment_id,
    a.name                                               as assessment_name,
    a.assessed_on,
    a.term,
    a.max_marks,
    m.marks_obtained,
    m.is_absent,
    round(m.marks_obtained / nullif(a.max_marks, 0) * 100, 2) as percent,
    public.grade_band(round(m.marks_obtained / nullif(a.max_marks, 0) * 100, 2)) as band,
    a.subject_id,   subj.name  as subject_name,  subj.code as subject_code,
    a.section_id,   sec.name   as section_name,  sec.class_id,
    cl.name         as class_name, cl.level as class_level,
    a.academic_year_id, ay.name as year_name, ay.is_current,
    at.code         as type_code, at.is_numeric
  from public.mark m
  join public.assessment a       on a.id  = m.assessment_id
  join public.assessment_type at on at.id = a.assessment_type_id
  join public.subject subj       on subj.id = a.subject_id
  join public.section sec        on sec.id  = a.section_id
  join public.class cl           on cl.id   = sec.class_id
  join public.academic_year ay   on ay.id   = a.academic_year_id
  join public.student st         on st.id   = m.student_id;

-- ---------------------------------------------------------------------------
-- Per-student subject trend with delta vs the student's own previous result
-- ("62, up from 55 last term"). Direction of travel is the headline.
-- ---------------------------------------------------------------------------
create view public.v_student_subject_trend with (security_invoker = true) as
  select
    d.*,
    round(d.percent - lag(d.percent) over w, 2)  as delta,
    lag(d.percent) over w                        as prev_percent,
    row_number() over w                          as seq
  from public.v_mark_detail d
  where d.is_numeric and d.marks_obtained is not null
  window w as (partition by d.student_id, d.subject_id
               order by d.assessed_on, d.assessment_id);

-- ---------------------------------------------------------------------------
-- Section × subject average per term (section-vs-section, subject-vs-subject).
-- ---------------------------------------------------------------------------
create view public.v_section_subject_summary with (security_invoker = true) as
  select
    section_id, section_name, class_id, class_name, class_level,
    subject_id, subject_name, subject_code,
    academic_year_id, year_name, term,
    round(avg(percent), 2) as avg_percent,
    round(min(percent), 2) as min_percent,
    round(max(percent), 2) as max_percent,
    count(*)               as n_marks,
    count(distinct student_id) as n_students
  from public.v_mark_detail
  where is_numeric and marks_obtained is not null
  group by section_id, section_name, class_id, class_name, class_level,
           subject_id, subject_name, subject_code, academic_year_id, year_name, term;

-- ---------------------------------------------------------------------------
-- Grade-band distribution per section × subject × year (latest term view is
-- filtered in the RPC; this view keeps every term).
-- ---------------------------------------------------------------------------
create view public.v_section_distribution with (security_invoker = true) as
  select section_id, subject_id, academic_year_id, term, band,
         count(*) as n
  from public.v_mark_detail
  where is_numeric and marks_obtained is not null and band is not null
  group by section_id, subject_id, academic_year_id, term, band;

-- ===========================================================================
-- RPC — all SECURITY INVOKER; RLS scopes the inputs automatically.
-- ===========================================================================

-- Top N performers in scope (per subject if given, else overall).
create or replace function public.top_performers(
  p_section bigint, p_year bigint, p_subject bigint default null, p_limit int default 5)
returns table(student_id bigint, student_name text, avg_percent numeric, n_marks bigint)
language sql stable security invoker set search_path = public as $$
  select student_id, student_name, round(avg(percent), 2), count(*)
  from public.v_mark_detail
  where section_id = p_section and academic_year_id = p_year
    and is_numeric and marks_obtained is not null
    and (p_subject is null or subject_id = p_subject)
  group by student_id, student_name
  order by 3 desc
  limit p_limit;
$$;

-- Students needing support: below threshold OR trending down over recent
-- assessments. Returns the reason (subjects + trend) for intervention framing.
-- RLS on the underlying tables means only authorised staff receive rows for
-- students other than their own; guardians calling this see at most their
-- own child (the UI never surfaces this list to guardians/students).
create or replace function public.needs_support(
  p_section bigint, p_year bigint, p_threshold numeric default 40)
returns table(
  student_id bigint, student_name text, avg_percent numeric,
  weak_subjects text, recent_trend numeric, reason text)
language sql stable security invoker set search_path = public as $$
  with per_student as (
    select student_id, student_name, round(avg(percent), 2) as avg_percent
    from public.v_mark_detail
    where section_id = p_section and academic_year_id = p_year
      and is_numeric and marks_obtained is not null
    group by student_id, student_name
  ),
  weak as (  -- subjects where the student averages below threshold
    select student_id, string_agg(distinct subject_name, ', ' order by subject_name) as weak_subjects
    from public.v_mark_detail
    where section_id = p_section and academic_year_id = p_year
      and is_numeric and marks_obtained is not null
    group by student_id, subject_id, subject_name
    having avg(percent) < p_threshold
  ),
  trend as (  -- net movement across the student's last 3 numeric results
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
         w.weak_subjects,
         coalesce(t.recent_trend, 0) as recent_trend,
         trim(both '; ' from
           concat_ws('; ',
             case when ps.avg_percent < p_threshold
                  then 'overall average ' || ps.avg_percent || '%' end,
             case when w.weak_subjects is not null
                  then 'weak in ' || w.weak_subjects end,
             case when coalesce(t.recent_trend, 0) < 0
                  then 'trending down ' || t.recent_trend || ' pts recently' end
           )) as reason
  from per_student ps
  left join weak w  on w.student_id = ps.student_id
  left join trend t on t.student_id = ps.student_id
  where ps.avg_percent < p_threshold
     or w.weak_subjects is not null
     or coalesce(t.recent_trend, 0) < -5
  order by ps.avg_percent asc;
$$;

-- Section-vs-section comparison for a subject within a class.
create or replace function public.section_comparison(
  p_class bigint, p_subject bigint, p_year bigint)
returns table(section_id bigint, section_name text, avg_percent numeric, n_students bigint)
language sql stable security invoker set search_path = public as $$
  select section_id, section_name, round(avg(percent), 2), count(distinct student_id)
  from public.v_mark_detail
  where class_id = p_class and subject_id = p_subject and academic_year_id = p_year
    and is_numeric and marks_obtained is not null
  group by section_id, section_name
  order by section_name;
$$;

-- Class-vs-class comparison across the school (principal scope in practice —
-- RLS returns only classes the caller can see).
create or replace function public.class_comparison(p_subject bigint, p_year bigint)
returns table(class_id bigint, class_name text, class_level smallint, avg_percent numeric, n_students bigint)
language sql stable security invoker set search_path = public as $$
  select class_id, class_name, class_level::smallint, round(avg(percent), 2), count(distinct student_id)
  from public.v_mark_detail
  where subject_id = p_subject and academic_year_id = p_year
    and is_numeric and marks_obtained is not null
  group by class_id, class_name, class_level
  order by class_level;
$$;

-- Auto-generated "Areas of improvement" — plain-language lines from real metrics.
create or replace function public.auto_conclusions(p_section bigint, p_year bigint)
returns setof text
language plpgsql stable security invoker set search_path = public as $$
declare
  r record;
begin
  -- 1) Largest term-over-term subject drop in the section.
  for r in
    with by_term as (
      select subject_name, term, avg_percent,
             lag(avg_percent) over (partition by subject_name order by term) as prev
      from public.v_section_subject_summary
      where section_id = p_section and academic_year_id = p_year and term is not null
    )
    select subject_name, round(avg_percent - prev, 1) as drop
    from by_term where prev is not null and avg_percent - prev <= -3
    order by (avg_percent - prev) asc limit 1
  loop
    return next format('%s average fell %s points since the previous term — the steepest drop in the section.',
                       r.subject_name, abs(r.drop));
  end loop;

  -- 2) Strongest subject in the section (current-ish overall average).
  for r in
    select subject_name, round(avg(percent), 1) as avg_pct
    from public.v_mark_detail
    where section_id = p_section and academic_year_id = p_year
      and is_numeric and marks_obtained is not null
    group by subject_name order by 2 desc limit 1
  loop
    return next format('%s is the section''s strongest subject, averaging %s%%.', r.subject_name, r.avg_pct);
  end loop;

  -- 3) Count of students trending down recently (support-before-exam signal).
  for r in
    select count(*) as n from public.needs_support(p_section, p_year)
    where recent_trend < 0
  loop
    if r.n > 0 then
      return next format('%s student(s) are trending downward across their recent assessments — flag for support before the next exam.', r.n);
    end if;
  end loop;

  return;
end $$;

grant execute on function
  public.grade_band(numeric),
  public.top_performers(bigint, bigint, bigint, int),
  public.needs_support(bigint, bigint, numeric),
  public.section_comparison(bigint, bigint, bigint),
  public.class_comparison(bigint, bigint),
  public.auto_conclusions(bigint, bigint)
to authenticated, service_role;
