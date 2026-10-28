-- =============================================================================
-- Migration 0039 — Phone number on student records
-- Staff and parent records already have one; the office can now keep a
-- student's own phone too (Give access, and the student form). Safe to re-run.
-- =============================================================================

alter table public.student add column if not exists phone text;

notify pgrst, 'reload schema';
