-- =============================================================================
-- Migration 0024 — Transport security: scope helpers + RLS on every new table
--
-- Same principle as 0002: RLS is the boundary, the UI is not. Transport adds
-- one hard rule on top of the existing model —
--
--   A guardian or student may see the LIVE POSITION of exactly the bus their
--   own child rides, only while a trip is running, and never its history.
--
-- Live location of a bus full of children is the most sensitive data in this
-- app. Parents get bus_live (one row, current) and stop events; the raw
-- breadcrumb trail in trip_ping is staff-only, with no owner policy at all —
-- the same shape as slippage_flag in 0002.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Who is crew?
-- ---------------------------------------------------------------------------
create or replace function app.is_transport()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(app.my_staff_role() = 'transport', false);
$$;

-- Assignments I crew this year (driver or conductor). Set-based so policies
-- stay index-friendly on big tables — the 0004 pattern.
create or replace function app.my_crew_assignments()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select a.id from public.bus_assignment a
  where a.is_active
    and a.academic_year_id = app.current_year_id()
    and app.my_staff_id() is not null
    and (a.driver_staff_id = app.my_staff_id() or a.conductor_staff_id = app.my_staff_id());
$$;

-- Routes my own children ride this year (guardian/student only).
create or replace function app.my_ridden_routes()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select st.route_id from public.student_transport st
  where st.is_active
    and st.academic_year_id = app.current_year_id()
    and app.owns_student(st.student_id);
$$;

-- Every route the caller may look at: all (admin) / crewed / ridden.
create or replace function app.my_transport_routes()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select r.id from public.route r where app.is_admin_scope()
  union
  select a.route_id from public.bus_assignment a where a.id in (select * from app.my_crew_assignments())
  union
  select r from app.my_ridden_routes() r;
$$;

-- Every bus the caller may see live. This is the one that matters.
create or replace function app.my_transport_buses()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select b.id from public.bus b where app.is_admin_scope()
  union
  select a.bus_id from public.bus_assignment a
  where a.is_active
    and a.academic_year_id = app.current_year_id()
    and (a.id in (select * from app.my_crew_assignments())
         or a.route_id in (select * from app.my_ridden_routes()));
$$;

-- Trips the caller may read (their bus's trips), and trips they may drive.
create or replace function app.my_visible_trips()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select t.id from public.trip t
    join public.bus_assignment a on a.id = t.bus_assignment_id
  where a.bus_id in (select * from app.my_transport_buses());
$$;

create or replace function app.my_crew_trips()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select t.id from public.trip t where t.bus_assignment_id in (select * from app.my_crew_assignments());
$$;

-- May the caller write a ping/stop event against this trip right now? Crew of
-- the trip, trip still running, and it is today's trip — a phone that wakes up
-- tomorrow with a queued batch cannot rewrite yesterday.
create or replace function app.can_log_trip(p_trip bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.trip t
    where t.id = p_trip
      and t.status = 'running'
      and t.service_date = app.school_today()
      and t.bus_assignment_id in (select * from app.my_crew_assignments())
  );
$$;

grant execute on function app.is_transport()            to authenticated, anon, service_role;
grant execute on function app.my_crew_assignments()     to authenticated, anon, service_role;
grant execute on function app.my_ridden_routes()        to authenticated, anon, service_role;
grant execute on function app.my_transport_routes()     to authenticated, anon, service_role;
grant execute on function app.my_transport_buses()      to authenticated, anon, service_role;
grant execute on function app.my_visible_trips()        to authenticated, anon, service_role;
grant execute on function app.my_crew_trips()           to authenticated, anon, service_role;
grant execute on function app.can_log_trip(bigint)      to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- RLS on every transport table
-- ---------------------------------------------------------------------------
alter table public.bus               enable row level security;
alter table public.route             enable row level security;
alter table public.route_stop        enable row level security;
alter table public.bus_assignment    enable row level security;
alter table public.student_transport enable row level security;
alter table public.trip              enable row level security;
alter table public.trip_ping         enable row level security;
alter table public.bus_live          enable row level security;
alter table public.trip_stop_event   enable row level security;
alter table public.transport_alert   enable row level security;

-- ===========================================================================
-- Fleet & routes — published information (the school prints these on a
-- noticeboard), so readable by any authenticated user, writable by office only.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['bus','route','route_stop','bus_assignment']
  loop
    execute format($f$
      create policy %1$s_read on public.%1$s
        for select to authenticated using (true);
      create policy %1$s_write on public.%1$s
        for all to authenticated
        using (app.is_admin_scope()) with check (app.is_admin_scope());
    $f$, t);
  end loop;
end $$;

-- ===========================================================================
-- Who rides which bus — as sensitive as the roster it hangs off, so it reuses
-- the existing student visibility rule (owner, section staff, admin).
-- ===========================================================================
create policy stransport_read on public.student_transport
  for select to authenticated using (app.can_view_student(student_id));
create policy stransport_write on public.student_transport
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- Trips — parents read their own bus's trips; only crew and office write.
-- ===========================================================================
create policy trip_read on public.trip
  for select to authenticated using (id in (select * from app.my_visible_trips()));
create policy trip_crew_start on public.trip
  for insert to authenticated with check (
    app.is_admin_scope() or bus_assignment_id in (select * from app.my_crew_assignments())
  );
create policy trip_crew_update on public.trip
  for update to authenticated using (
    app.is_admin_scope() or bus_assignment_id in (select * from app.my_crew_assignments())
  ) with check (
    app.is_admin_scope() or bus_assignment_id in (select * from app.my_crew_assignments())
  );
create policy trip_admin_delete on public.trip
  for delete to authenticated using (app.is_admin_scope());

-- ===========================================================================
-- Raw GPS breadcrumbs — CREW AND OFFICE ONLY (§ header note).
-- There is deliberately no owner policy, so a parent reading trip_ping gets
-- zero rows however the client asks. Insert is gated on can_log_trip: your own
-- running trip, today, only.
-- ===========================================================================
create policy ping_staff_read on public.trip_ping
  for select to authenticated using (
    app.is_admin_scope() or trip_id in (select * from app.my_crew_trips())
  );
create policy ping_crew_insert on public.trip_ping
  for insert to authenticated with check (app.can_log_trip(trip_id));
create policy ping_admin_delete on public.trip_ping
  for delete to authenticated using (app.is_admin_scope());

-- ===========================================================================
-- Live position — the one row a parent's map subscribes to. Written only by the
-- SECURITY DEFINER trigger in 0025 (and office), never by a client.
-- ===========================================================================
create policy buslive_read on public.bus_live
  for select to authenticated using (bus_id in (select * from app.my_transport_buses()));
create policy buslive_admin_write on public.bus_live
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- Stop arrivals/departures — visible to anyone who may see the bus, so a parent
-- can watch stops tick off. Crew may write manual confirmations.
-- ===========================================================================
create policy stopevent_read on public.trip_stop_event
  for select to authenticated using (trip_id in (select * from app.my_visible_trips()));
create policy stopevent_crew_write on public.trip_stop_event
  for insert to authenticated with check (
    app.is_admin_scope() or app.can_log_trip(trip_id)
  );
create policy stopevent_admin_write on public.trip_stop_event
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());

-- ===========================================================================
-- Alert outbox — a parent sees only alerts about their own child.
-- Rows are queued by triggers and drained server-side; no client writes.
-- ===========================================================================
create policy alert_read on public.transport_alert
  for select to authenticated using (
    app.owns_student(student_id) or app.is_admin_scope()
  );
create policy alert_admin_write on public.transport_alert
  for all to authenticated using (app.is_admin_scope()) with check (app.is_admin_scope());
