-- =============================================================================
-- Migration 0031 — Take the alert dispatcher's credentials out of a database
-- parameter and put them in Vault.
--
-- 0028 read app.functions_url / app.service_key via current_setting(). On a
-- managed Supabase project the postgres role is not allowed to ALTER DATABASE
-- SET those, so the job could never actually be configured — it would report
-- "not configured" forever. Supabase ships supabase_vault for exactly this: the
-- service-role key is stored encrypted and only ever decrypted inside a
-- SECURITY DEFINER function that no client can call.
--
-- CONFIGURE (run once, from the SQL editor or a trusted script — never commit
-- the key):
--
--   select vault.create_secret('https://<ref>.functions.supabase.co',
--                              'transport_functions_url');
--   select vault.create_secret('<service-role key>', 'transport_service_key');
--
-- Until both secrets exist the job stays a deliberate no-op and says so.
-- =============================================================================

create or replace function app.vault_secret(p_name text)
returns text language sql stable security definer set search_path = vault, pg_temp as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;
-- Not granted to anon/authenticated on purpose: only other SECURITY DEFINER
-- functions in this schema have any business reading it.
revoke all on function app.vault_secret(text) from public, anon, authenticated;

create or replace function public.drain_transport_alerts()
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url  text := app.vault_secret('transport_functions_url');
  v_key  text := app.vault_secret('transport_service_key');
  v_due  int;
begin
  select count(*) into v_due from public.transport_alert where sent_at is null;
  if v_due = 0 then return 'nothing due'; end if;
  if v_url is null or v_key is null then
    return format('%s alert(s) waiting; transport_functions_url / transport_service_key not in Vault', v_due);
  end if;

  perform net.http_post(
    url     := v_url || '/transport-alert',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
  return format('dispatched %s alert(s)', v_due);
end $$;

revoke all on function public.drain_transport_alerts() from public, anon, authenticated;
