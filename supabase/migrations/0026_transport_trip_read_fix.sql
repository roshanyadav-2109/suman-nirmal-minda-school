-- =============================================================================
-- Migration 0026 — Fix: a conductor could not start a trip.
--
-- trip_read was written as `id in (select * from app.my_visible_trips())`, and
-- my_visible_trips() reads public.trip itself. On INSERT ... RETURNING —
-- which is what PostgREST issues for every insert — Postgres re-checks the
-- SELECT policy against the new row, but that STABLE SECURITY DEFINER function
-- runs on the statement's snapshot and therefore cannot see the row the same
-- statement is inserting. The policy evaluated false and the insert was
-- refused with "new row violates row-level security policy", even though the
-- conductor genuinely crews that bus.
--
-- The rule is unchanged; only what it is computed FROM changes. Visibility now
-- hangs off the row's own bus_assignment_id against pre-existing rows in
-- bus_assignment, so it never depends on seeing the new row.
-- =============================================================================

-- Assignments whose bus the caller may see: office (all), crew (theirs), and
-- families (the bus their own child rides).
create or replace function app.my_visible_assignments()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select a.id from public.bus_assignment a
  where a.bus_id in (select * from app.my_transport_buses());
$$;
grant execute on function app.my_visible_assignments() to authenticated, anon, service_role;

drop policy if exists trip_read on public.trip;
create policy trip_read on public.trip
  for select to authenticated
  using (bus_assignment_id in (select * from app.my_visible_assignments()));

-- Same reasoning, one level down: these read trip (a row that already exists by
-- the time a ping or stop event is written), so they are safe as they stand —
-- but routing them through the assignment set keeps the two consistent and
-- saves a join per check.
create or replace function app.my_visible_trips()
returns setof bigint language sql stable security definer set search_path = public, pg_temp as $$
  select t.id from public.trip t
  where t.bus_assignment_id in (select * from app.my_visible_assignments());
$$;
