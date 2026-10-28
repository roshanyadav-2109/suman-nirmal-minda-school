-- =============================================================================
-- Migration 0040 — Security hardening (from the security review)
--
--  * Signed-out visitors (anon) can no longer call any security-definer
--    function: the portal needs a sign-in for everything, so they never need to.
--  * Scheduled maintenance jobs (closing stale bus trips, expiring alerts,
--    purging old pings, recomputing route distances) can be run only by the
--    database itself (cron / triggers), not by any signed-in user.
--  * Functions without a fixed search_path get one, so a crafted schema can't
--    redirect what they call.
-- Safe to run more than once.
-- =============================================================================

do $$
declare f record;
begin
  -- 1. No security-definer function is callable by signed-out visitors.
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prosecdef
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;

  -- 2. Maintenance jobs: database only.
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('end_stale_trips', 'expire_stale_alerts', 'purge_old_pings', 'recompute_route_distances')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;

  -- 3. A fixed search_path on the functions that lacked one.
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in ('grade_band', 'set_updated_at'))
       or (n.nspname = 'app' and p.proname in ('haversine_m', 'road_m'))
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- Signed-in users keep what the portal and its row rules rely on: the
-- security-definer helpers stay executable by `authenticated` (granted when
-- each was created); only the maintenance jobs above are taken from them.
