-- =============================================================================
-- Migration 0038 — Let a Google email move from one school record to another
--
-- Google sign-in gives access to whichever record (staff, parent, student)
-- currently holds the Google email. When the office moves an email from one
-- record to another, the old record's login must let go of it: this frees the
-- email and its Google link from every login except the one being signed into.
-- Only the server (service role) may call it. Safe to run more than once.
-- =============================================================================

create or replace function public.release_login_email(p_email text, p_keep uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  -- Other logins that carry this Google account lose the link.
  delete from auth.identities i
   where i.provider = 'google'
     and i.user_id <> p_keep
     and lower(i.identity_data->>'email') = lower(p_email);
  -- Other logins using this email address get a placeholder instead.
  update auth.users u
     set email = 'released-' || u.id || '@noreply.invalid'
   where lower(u.email) = lower(p_email)
     and u.id <> p_keep;
end $$;

revoke all on function public.release_login_email(text, uuid) from public, anon, authenticated;
grant execute on function public.release_login_email(text, uuid) to service_role;
