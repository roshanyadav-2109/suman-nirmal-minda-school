-- =============================================================================
-- Migration 0036 — Speed: cheaper row-security checks and "needs help" lists
--
-- Same rules, evaluated far less often:
--  * Policies called app.is_admin_scope() / my_staff_id() / is_principal() /
--    is_office() bare, i.e. once per ROW. Wrapped in (select ...) they run once
--    per query. "for all" write policies also apply to reads, so this speeds up
--    every list the office and principal open.
--  * app.ct_of_section(section, year) ran a lookup per row (1.4 s for a month of
--    school attendance). It becomes membership in the caller's class-teacher
--    (section, year) pairs, fetched once. ct_of_section(section) (current year)
--    becomes membership in app.my_ct_sections().
--  * needs_support / needs_support_class computed the subject trend over every
--    mark in the school before filtering (1.2 s per section); they now compute it
--    for the group's own students only. Results are unchanged.
-- Safe to run more than once.
-- =============================================================================

-- Every (section, year) the caller is class teacher of — same test as
-- app.ct_of_section(section, year), as a set.
create or replace function app.my_ct_section_years()
returns table(section_id bigint, academic_year_id bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct a.section_id, a.academic_year_id
  from public.teacher_allotment a
  where a.staff_id = app.my_staff_id() and a.is_class_teacher;
$$;
grant execute on function app.my_ct_section_years() to authenticated, service_role;

alter policy academic_year_write on public.academic_year
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy announcement_write on public.announcement
  using (((select app.is_admin_scope()) OR (created_by = (select app.my_staff_id()))))
  with check (((select app.is_admin_scope()) OR (created_by = (select app.my_staff_id()))));

alter policy assessment_type_write on public.assessment_type
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy attendance_write on public.attendance_record
  using (((section_id, academic_year_id) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s)))
  with check (((section_id, academic_year_id) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s)));

alter policy bus_write on public.bus
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy bus_assignment_write on public.bus_assignment
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy buslive_admin_write on public.bus_live
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy class_write on public.class
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy class_subject_write on public.class_subject
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy event_write on public.event
  using (((select app.is_admin_scope()) OR (created_by = (select app.my_staff_id()))))
  with check (((select app.is_admin_scope()) OR (created_by = (select app.my_staff_id()))));

alter policy feedback_read on public.feedback
  using (((select app.is_principal()) OR (from_profile = auth.uid()) OR (section_id in (select app.my_ct_sections()))));

alter policy feedback_respond on public.feedback
  using (((select app.is_principal()) OR (section_id in (select app.my_ct_sections()))))
  with check (((select app.is_principal()) OR (section_id in (select app.my_ct_sections()))));

alter policy guardian_admin_write on public.guardian
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy gs_admin_write on public.guardian_student
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy hpc_read on public.hpc_input
  using (((select app.is_admin_scope()) OR app.can_view_student(student_id) OR app.owns_student(student_id)));

alter policy leave_decide on public.leave_application
  using (((section_id, academic_year_id) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s)))
  with check (((section_id, academic_year_id) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s)));

alter policy leave_read on public.leave_application
  using ((app.owns_student(student_id) OR ((section_id, academic_year_id) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s))));

alter policy profile_admin_write on public.profile
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy profile_self_read on public.profile
  using (((id = auth.uid()) OR (select app.is_admin_scope())));

alter policy promotion_admin_write on public.promotion
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy promotion_read on public.promotion
  using (((select app.is_admin_scope()) OR ((from_section_id, coalesce(from_year_id, (select app.current_year_id()))) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s)) OR ((to_section_id, to_year_id) in (select s.section_id, s.academic_year_id from app.my_ct_section_years() s))));

alter policy route_write on public.route
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy route_stop_write on public.route_stop
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy school_write on public.school
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy section_write on public.section
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy slippage_write on public.slippage_flag
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy staff_write on public.staff
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy student_admin_write on public.student
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy enroll_admin_write on public.student_enrollment
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy stransport_write on public.student_transport
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy subject_write on public.subject
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy allot_admin_write on public.teacher_allotment
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy allot_read on public.teacher_allotment
  using (((select app.is_admin_scope()) OR (staff_id = (select app.my_staff_id()))));

alter policy alert_admin_write on public.transport_alert
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy alert_read on public.transport_alert
  using ((app.owns_student(student_id) OR (select app.is_admin_scope())));

alter policy trip_admin_delete on public.trip
  using ((select app.is_admin_scope()));

alter policy trip_crew_start on public.trip
  with check (((select app.is_admin_scope()) OR (bus_assignment_id IN ( SELECT my_crew_assignments.my_crew_assignments
   FROM app.my_crew_assignments() my_crew_assignments(my_crew_assignments)))));

alter policy trip_crew_update on public.trip
  using (((select app.is_admin_scope()) OR (bus_assignment_id IN ( SELECT my_crew_assignments.my_crew_assignments
   FROM app.my_crew_assignments() my_crew_assignments(my_crew_assignments)))))
  with check (((select app.is_admin_scope()) OR (bus_assignment_id IN ( SELECT my_crew_assignments.my_crew_assignments
   FROM app.my_crew_assignments() my_crew_assignments(my_crew_assignments)))));

alter policy ping_admin_delete on public.trip_ping
  using ((select app.is_admin_scope()));

alter policy ping_staff_read on public.trip_ping
  using (((select app.is_admin_scope()) OR (trip_id IN ( SELECT my_crew_trips.my_crew_trips
   FROM app.my_crew_trips() my_crew_trips(my_crew_trips)))));

alter policy stopevent_admin_write on public.trip_stop_event
  using ((select app.is_admin_scope()))
  with check ((select app.is_admin_scope()));

alter policy stopevent_crew_write on public.trip_stop_event
  with check (((select app.is_admin_scope()) OR app.can_log_trip(trip_id)));

create or replace function public.needs_support(p_section bigint, p_year bigint, p_threshold numeric default 40)
 returns table(student_id bigint, student_name text, avg_percent numeric, weak_subjects text, recent_trend numeric, reason text)
 language sql stable set search_path to 'public' as $$
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
  -- Each mark's change from the same student's previous mark in that subject,
  -- worked out only for this group's students (filtering on student_id lets the
  -- window run on their marks alone, not the whole school's).
  deltas as (
    select d.student_id, d.section_id, d.class_id, d.academic_year_id, d.assessed_on, d.assessment_id,
           round(d.percent - lag(d.percent) over (partition by d.student_id, d.subject_id
                                                  order by d.assessed_on, d.assessment_id), 2) as delta
    from public.v_mark_detail d
    where d.is_numeric and d.marks_obtained is not null
      and d.student_id in (select student_id from per_student)
  ),
  trend as (
    select student_id, round(sum(delta), 2) as recent_trend
    from (
      select student_id, delta,
             row_number() over (partition by student_id order by assessed_on desc, assessment_id desc) rn
      from deltas
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

create or replace function public.needs_support_class(p_class bigint, p_year bigint, p_threshold numeric default 40)
 returns table(student_id bigint, student_name text, section_name text, avg_percent numeric, weak_subjects text, recent_trend numeric, reason text)
 language sql stable set search_path to 'public' as $$
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
  -- Each mark's change from the same student's previous mark in that subject,
  -- worked out only for this group's students (filtering on student_id lets the
  -- window run on their marks alone, not the whole school's).
  deltas as (
    select d.student_id, d.section_id, d.class_id, d.academic_year_id, d.assessed_on, d.assessment_id,
           round(d.percent - lag(d.percent) over (partition by d.student_id, d.subject_id
                                                  order by d.assessed_on, d.assessment_id), 2) as delta
    from public.v_mark_detail d
    where d.is_numeric and d.marks_obtained is not null
      and d.student_id in (select student_id from per_student)
  ),
  trend as (
    select student_id, round(sum(delta), 2) as recent_trend
    from (
      select student_id, delta,
             row_number() over (partition by student_id order by assessed_on desc, assessment_id desc) rn
      from deltas
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

notify pgrst, 'reload schema';
