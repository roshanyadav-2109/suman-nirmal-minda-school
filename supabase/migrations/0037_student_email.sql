-- =============================================================================
-- Migration 0037 — Email on student records, for Google sign-in
--
-- Google sign-in finds a person by the email on their school record (staff,
-- parent, and now student). Lookups are case-insensitive, so each table gets an
-- index on lower(email). Safe to run more than once.
-- =============================================================================

alter table public.student add column if not exists email text;

create index if not exists idx_staff_email_lower    on public.staff    (lower(email)) where email is not null;
create index if not exists idx_guardian_email_lower on public.guardian (lower(email)) where email is not null;
create index if not exists idx_student_email_lower  on public.student  (lower(email)) where email is not null;

notify pgrst, 'reload schema';
