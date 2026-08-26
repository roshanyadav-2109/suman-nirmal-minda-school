-- =============================================================================
-- Migration 0020
--   A. create_class_exam — a teacher (or office) creates a NEW exam column for a
--      subject in a class; it fans out to an assessment row in EVERY section of
--      that class, so the exam becomes visible in all sections at once. Drafts
--      (unpublished) until marks are entered and released.
--   B. Student promotion / Transfer Certificate (TC) workflow. Office promotes a
--      cohort to the next session; sections may change; a pupil may be marked
--      transferred (TC) or graduated. Principal & class teachers see a summary
--      of who was promoted and how many.
-- =============================================================================

-- ===========================================================================
-- A. Create-exam (data-driven; nothing hardcoded in app logic)
-- ===========================================================================
create or replace function public.create_class_exam(
  p_class bigint, p_subject bigint, p_name text, p_term int, p_max numeric,
  p_date date, p_year bigint, p_type text default 'periodic_test')
returns integer language plpgsql security definer set search_path = public as $$
declare v_type bigint; v_cnt int := 0; v_sec bigint;
begin
  -- Authorization: office/principal, or a teacher who teaches this subject in
  -- this class, or a class teacher of any section of this class (in that year).
  if not (
    app.is_admin_scope()
    or exists (select 1 from public.teacher_allotment ta
               join public.section s on s.id = ta.section_id
               where s.class_id = p_class and ta.academic_year_id = p_year
                 and ta.staff_id = app.my_staff_id()
                 and (ta.subject_id = p_subject or ta.is_class_teacher))
  ) then raise exception 'not authorized to create exams for this class'; end if;

  if coalesce(btrim(p_name), '') = '' then raise exception 'exam name required'; end if;

  select id into v_type from public.assessment_type where code = p_type;
  if v_type is null then select id into v_type from public.assessment_type where code = 'periodic_test'; end if;

  for v_sec in select id from public.section where class_id = p_class loop
    if not exists (select 1 from public.assessment a
                   where a.section_id = v_sec and a.subject_id = p_subject
                     and a.academic_year_id = p_year and a.name = p_name) then
      insert into public.assessment (assessment_type_id, subject_id, section_id, academic_year_id, term, name, assessed_on, max_marks, is_published)
        values (v_type, p_subject, v_sec, p_year, p_term, btrim(p_name), p_date, p_max, false);
      v_cnt := v_cnt + 1;
    end if;
  end loop;
  return v_cnt;
end $$;
grant execute on function public.create_class_exam(bigint, bigint, text, int, numeric, date, bigint, text) to authenticated, service_role;

-- ===========================================================================
-- B. Promotion / TC
-- ===========================================================================
alter table public.student
  add column if not exists status text not null default 'active',
  add column if not exists left_on date,
  add column if not exists exit_remark text;
do $$ begin
  alter table public.student add constraint student_status_chk check (status in ('active','transferred','alumni'));
exception when duplicate_object then null; end $$;

create table if not exists public.promotion (
  id              bigint generated always as identity primary key,
  student_id      bigint not null references public.student(id) on delete cascade,
  from_year_id    bigint references public.academic_year(id),
  to_year_id      bigint not null references public.academic_year(id),
  from_section_id bigint references public.section(id),
  to_section_id   bigint references public.section(id),      -- null for transfer/graduate
  outcome         text not null check (outcome in ('promoted','retained','transferred','graduated')),
  decided_by      bigint references public.staff(id),
  created_at      timestamptz not null default now(),
  unique (student_id, to_year_id)
);
create index if not exists idx_promotion_toyear on public.promotion (to_year_id);
create index if not exists idx_promotion_from_sec on public.promotion (from_section_id);
create index if not exists idx_promotion_to_sec on public.promotion (to_section_id);

alter table public.promotion enable row level security;
drop policy if exists promotion_read on public.promotion;
create policy promotion_read on public.promotion for select to authenticated using (
  app.is_admin_scope()
  or app.ct_of_section(from_section_id, from_year_id)
  or app.ct_of_section(to_section_id, to_year_id)
);
drop policy if exists promotion_admin_write on public.promotion;
create policy promotion_admin_write on public.promotion for all to authenticated
  using (app.is_admin_scope()) with check (app.is_admin_scope());

-- Apply a set of promotion decisions atomically. Office/admin only.
-- p_rows = [{ "student_id":.., "outcome":"promoted|retained|transferred|graduated", "to_section_id":.., "remark":".." }]
create or replace function public.commit_promotion(p_from_year bigint, p_to_year bigint, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; cnt int := 0;
        v_student bigint; v_outcome text; v_to_section bigint; v_from_section bigint; v_roll smallint;
        v_to_start date;
begin
  if not app.is_admin_scope() then raise exception 'not authorized'; end if;
  select start_date into v_to_start from public.academic_year where id = p_to_year;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_student   := (r->>'student_id')::bigint;
    v_outcome   := r->>'outcome';
    v_to_section := nullif(r->>'to_section_id','')::bigint;
    select section_id, roll_no into v_from_section, v_roll
      from public.student_enrollment where student_id = v_student and academic_year_id = p_from_year;

    if v_outcome in ('promoted','retained') then
      if v_to_section is null then raise exception 'target section required for student %', v_student; end if;
      insert into public.student_enrollment (student_id, academic_year_id, section_id, roll_no)
        values (v_student, p_to_year, v_to_section, coalesce(v_roll, 0))
        on conflict (student_id, academic_year_id) do update set section_id = excluded.section_id;
    elsif v_outcome = 'transferred' then
      update public.student set status = 'transferred', left_on = coalesce(v_to_start, left_on),
             exit_remark = coalesce(nullif(btrim(r->>'remark'), ''), exit_remark) where id = v_student;
    elsif v_outcome = 'graduated' then
      update public.student set status = 'alumni', left_on = coalesce(v_to_start, left_on) where id = v_student;
    else
      raise exception 'unknown outcome %', v_outcome;
    end if;

    insert into public.promotion (student_id, from_year_id, to_year_id, from_section_id, to_section_id, outcome, decided_by)
      values (v_student, p_from_year, p_to_year, v_from_section,
              case when v_outcome in ('promoted','retained') then v_to_section else null end, v_outcome, app.my_staff_id())
      on conflict (student_id, to_year_id) do update
        set outcome = excluded.outcome, to_section_id = excluded.to_section_id,
            from_section_id = excluded.from_section_id, decided_by = excluded.decided_by, created_at = now();
    cnt := cnt + 1;
  end loop;
  -- renumber rolls in the affected target sections (by pupil name)
  update public.student_enrollment e set roll_no = r.rn
  from (
    select id, row_number() over (partition by section_id order by (select full_name from public.student where id = student_id)) rn
    from public.student_enrollment where academic_year_id = p_to_year
  ) r where e.id = r.id and e.academic_year_id = p_to_year;
  return cnt;
end $$;
grant execute on function public.commit_promotion(bigint, bigint, jsonb) to authenticated, service_role;

-- Per-class promotion summary for a target year (RLS-scoped: admin = all,
-- class teacher = their own class). Grouped by the class promoted FROM.
create or replace function public.promotion_summary(p_to_year bigint)
returns table(class_id bigint, class_name text, class_level smallint,
              promoted bigint, retained bigint, transferred bigint, graduated bigint, total bigint)
language sql stable security invoker set search_path = public as $$
  select cl.id, cl.name, cl.level::smallint,
         count(*) filter (where p.outcome = 'promoted'),
         count(*) filter (where p.outcome = 'retained'),
         count(*) filter (where p.outcome = 'transferred'),
         count(*) filter (where p.outcome = 'graduated'),
         count(*)
  from public.promotion p
  join public.section fs on fs.id = p.from_section_id
  join public.class cl on cl.id = fs.class_id
  where p.to_year_id = p_to_year
  group by cl.id, cl.name, cl.level
  order by cl.level;
$$;
grant execute on function public.promotion_summary(bigint) to authenticated, service_role;
