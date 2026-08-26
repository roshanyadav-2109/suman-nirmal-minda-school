-- =============================================================================
-- Demo data adjustment — make teachers genuinely dual-role.
-- A teacher is ONE person: class teacher of their own section (full access to
-- all subjects there) AND subject teacher across other sections (subject-only).
-- Safe to re-run: only touches teacher_allotment for the current year.
-- =============================================================================
do $$
declare
  y bigint := (select id from public.academic_year where is_current);
  sci bigint := (select id from public.subject where code = 'SCI');
  eng bigint := (select id from public.subject where code = 'ENG');
  ct01 bigint := (select id from public.staff where employee_code = 'CT01'); -- Mrs. Anindita Sen (VIII-A CT)
  ct09 bigint := (select id from public.staff where employee_code = 'CT09'); -- current VI-C CT
  st07 bigint := (select id from public.staff where employee_code = 'ST07'); -- Mr. Rajarshi Dutta (Maths)
begin
  -- 1) Class teacher of VIII-A ALSO teaches Science in VIII-A (own), VIII-B, VII-A.
  insert into public.teacher_allotment (staff_id, section_id, subject_id, academic_year_id, is_class_teacher)
  select ct01, sec.id, sci, y, false
  from public.section sec join public.class c on c.id = sec.class_id
  where (c.level = 8 and sec.name in ('A','B')) or (c.level = 7 and sec.name = 'A')
  on conflict (staff_id, section_id, subject_id, academic_year_id) do nothing;

  -- 2) The Maths subject teacher ALSO becomes class teacher of VI-C (he already
  --    teaches Maths there). Displace the old VI-C class teacher first.
  delete from public.teacher_allotment ta
  using public.section sec join public.class c on c.id = sec.class_id
  where ta.section_id = sec.id and c.level = 6 and sec.name = 'C'
    and ta.is_class_teacher and ta.academic_year_id = y;

  insert into public.teacher_allotment (staff_id, section_id, subject_id, academic_year_id, is_class_teacher)
  select st07, (select sec.id from public.section sec join public.class c on c.id = sec.class_id where c.level = 6 and sec.name = 'C'),
         null, y, true
  on conflict (staff_id, section_id, subject_id, academic_year_id) do nothing;

  -- 3) Keep the displaced teacher active as a subject teacher (English in VI-B, VI-C).
  insert into public.teacher_allotment (staff_id, section_id, subject_id, academic_year_id, is_class_teacher)
  select ct09, sec.id, eng, y, false
  from public.section sec join public.class c on c.id = sec.class_id
  where c.level = 6 and sec.name in ('B','C')
  on conflict (staff_id, section_id, subject_id, academic_year_id) do nothing;
end $$;

-- Show the two demo teachers' resulting scope.
select s.employee_code, s.full_name,
       c.name || '-' || sec.name as section,
       coalesce(subj.name, 'ALL (class teacher)') as teaches,
       a.is_class_teacher
from public.teacher_allotment a
  join public.staff s on s.id = a.staff_id
  join public.section sec on sec.id = a.section_id
  join public.class c on c.id = sec.class_id
  left join public.subject subj on subj.id = a.subject_id
where s.employee_code in ('CT01','ST07') and a.academic_year_id = (select id from public.academic_year where is_current)
order by s.employee_code, a.is_class_teacher desc, section;
