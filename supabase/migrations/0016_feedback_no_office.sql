-- =============================================================================
-- Migration 0016 — Feedback is a teacher/principal concern, not the office's.
-- Swap the admin-scope check (principal OR office) for principal-only, so the
-- office can no longer read or respond to parent feedback. Guardians (senders)
-- and class teachers are unchanged.
-- =============================================================================
drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select to authenticated using (
  app.is_principal() or from_profile = auth.uid() or app.ct_of_section(section_id)
);

drop policy if exists feedback_respond on public.feedback;
create policy feedback_respond on public.feedback for update to authenticated using (
  app.is_principal() or app.ct_of_section(section_id)
) with check (
  app.is_principal() or app.ct_of_section(section_id)
);
