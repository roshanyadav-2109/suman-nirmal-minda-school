-- =============================================================================
-- Migration 0007 — Schedule the nightly slippage computation with pg_cron.
-- =============================================================================
create extension if not exists pg_cron;

-- Idempotent (re)schedule.
do $$
begin
  perform cron.unschedule('kv-slippage-nightly');
exception when others then null;
end $$;

select cron.schedule('kv-slippage-nightly', '0 2 * * *', $$select public.refresh_slippage_flags();$$);
