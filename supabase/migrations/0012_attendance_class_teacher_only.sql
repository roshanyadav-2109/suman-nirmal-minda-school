-- =============================================================================
-- Migration 0012 — Attendance is marked by the CLASS TEACHER only.
-- Previously any teacher allotted to a section (incl. subject teachers) or an
-- admin could write attendance. Restrict writes to the class teacher of that
-- section. Reads are unchanged (owner, staff-in-scope, principal/office).
-- =============================================================================
drop policy if exists attendance_write on public.attendance_record;
create policy attendance_write on public.attendance_record for all to authenticated
  using (app.ct_of_section(section_id, academic_year_id))
  with check (app.ct_of_section(section_id, academic_year_id));
