-- =============================================================================
-- Migration 0028 — Drain the transport alert outbox.
--
-- The triggers in 0025 decide WHAT to tell a family the instant it becomes
-- true, inside the transaction that observed it. Delivery is deliberately a
-- separate, retryable step: a failed email leaves sent_at null and is retried,
-- rather than rolling back the arrival that caused it.
--
-- CONFIGURATION (no secret is stored in this repo):
--
--   alter database postgres set app.functions_url = 'https://<ref>.functions.supabase.co';
--   alter database postgres set app.service_key   = '<service-role key>';
--
-- Until both are set the job is a deliberate no-op — it does nothing and says
-- so, rather than failing every minute or shipping a key in version control.
-- =============================================================================

create extension if not exists pg_net;

create or replace function public.drain_transport_alerts()
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url  text := current_setting('app.functions_url', true);
  v_key  text := current_setting('app.service_key', true);
  v_due  int;
begin
  select count(*) into v_due from public.transport_alert where sent_at is null;
  if v_due = 0 then return 'nothing due'; end if;
  if v_url is null or v_key is null then
    return format('%s alert(s) waiting; app.functions_url / app.service_key not configured', v_due);
  end if;

  perform net.http_post(
    url     := v_url || '/transport-alert',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
  return format('dispatched %s alert(s)', v_due);
end $$;

-- A "your bus is five minutes away" message is worse than useless an hour
-- late. Anything undelivered after two hours is retired, not retried, so the
-- outbox cannot grow without bound and no parent is told about a bus that
-- reached their stop this morning.
create or replace function public.expire_stale_alerts()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update public.transport_alert
     set sent_at = now(), channel = 'expired'
   where sent_at is null and created_at < now() - interval '2 hours';
  get diagnostics n = row_count;
  return n;
end $$;

do $$ begin perform cron.unschedule('transport-alert-drain');  exception when others then null; end $$;
do $$ begin perform cron.unschedule('transport-alert-expire'); exception when others then null; end $$;
select cron.schedule('transport-alert-drain',  '* * * * *',  $$select public.drain_transport_alerts();$$);
select cron.schedule('transport-alert-expire', '15 * * * *', $$select public.expire_stale_alerts();$$);
