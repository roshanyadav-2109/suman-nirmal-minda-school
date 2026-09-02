-- =============================================================================
-- Migration 0029 — A finished route must stop claiming it is running.
--
-- 0025/0027 advanced the trip stop by stop, but when the LAST stop was reached
-- the trigger still upserted bus_live with is_running = true and next_stop_id,
-- eta_seconds and stops_remaining all null. Nothing marked the route finished,
-- so a parent's dashboard card kept reading "on the way" — with no stop and no
-- ETA — long after the bus had parked at the school. The feature's one promise
-- is that it does not lie about where a child's bus is; this broke it.
--
-- Now the last arrival completes the trip. The existing trg_trip_status trigger
-- then clears bus_live (is_running false, no next stop, no ETA) in the same
-- transaction, so the board and the card go quiet together.
-- =============================================================================

create or replace function app.on_trip_ping()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_trip        public.trip;
  v_assign      public.bus_assignment;
  v_next        record;
  v_dist        double precision;
  v_road        double precision;
  v_speed       double precision;   -- m/s
  v_eta         int;
  v_remaining   int;
  v_sched       time;
  v_delay_min   int;
begin
  -- Junk filter: a fix worse than 150 m is stored (for diagnostics) but must
  -- never move the marker a parent is watching.
  if new.accuracy_m is not null and new.accuracy_m > 150 then
    return null;
  end if;

  select * into v_trip from public.trip where id = new.trip_id;
  if v_trip.status <> 'running' then return null; end if;
  select * into v_assign from public.bus_assignment where id = v_trip.bus_assignment_id;

  -- Next stop = first in running order without an 'arrived' event.
  select s.* into v_next
  from app.trip_stop_order(new.trip_id) s
  where not exists (
    select 1 from public.trip_stop_event e
    where e.trip_id = new.trip_id and e.route_stop_id = s.stop_id and e.event = 'arrived')
  order by s.ord
  limit 1;

  -- Every stop reached: the run is over. Complete the trip and let
  -- trg_trip_status put bus_live to sleep rather than leaving it "running"
  -- with nothing to report.
  if v_next.stop_id is null then
    update public.trip
       set status = 'completed', ended_at = coalesce(ended_at, now())
     where id = new.trip_id and status = 'running';
    return null;
  end if;

  v_dist := app.haversine_m(new.lat, new.lng, v_next.lat, v_next.lng);
  v_road := app.road_m(v_dist);

  select greatest(coalesce(avg(p.speed_kmh) filter (where p.speed_kmh is not null), 18), 12) / 3.6
    into v_speed
  from public.trip_ping p
  where p.trip_id = new.trip_id and p.captured_at > now() - interval '5 minutes';

  v_eta := greatest(0, round(v_road / nullif(v_speed, 0))::int);
  select count(*)::int into v_remaining
  from app.trip_stop_order(new.trip_id) s
  where s.ord >= v_next.ord
    and not exists (select 1 from public.trip_stop_event e
                    where e.trip_id = new.trip_id and e.route_stop_id = s.stop_id and e.event = 'arrived');

  insert into public.bus_live as bl
    (bus_id, trip_id, route_id, lat, lng, speed_kmh, heading, next_stop_id,
     eta_seconds, stops_remaining, is_running, updated_at)
  values (v_assign.bus_id, new.trip_id, v_assign.route_id, new.lat, new.lng,
          new.speed_kmh, new.heading, v_next.stop_id, v_eta, v_remaining, true, now())
  on conflict (bus_id) do update set
    trip_id = excluded.trip_id, route_id = excluded.route_id,
    lat = excluded.lat, lng = excluded.lng, speed_kmh = excluded.speed_kmh,
    heading = excluded.heading, next_stop_id = excluded.next_stop_id,
    eta_seconds = excluded.eta_seconds, stops_remaining = excluded.stops_remaining,
    is_running = true, updated_at = now();

  if v_dist <= v_next.geofence_m then
    insert into public.trip_stop_event (trip_id, route_stop_id, event)
    values (new.trip_id, v_next.stop_id, 'arrived')
    on conflict do nothing;

    insert into public.transport_alert (student_id, trip_id, route_stop_id, kind, payload)
    select st.student_id, new.trip_id, v_next.stop_id, 'arrived',
           jsonb_build_object('stop_id', v_next.stop_id, 'at', now())
    from public.student_transport st
    where st.is_active
      and st.academic_year_id = v_assign.academic_year_id
      and st.route_id = v_assign.route_id
      and (case when v_trip.shift = 'morning' then st.pickup_stop_id else st.drop_stop_id end) = v_next.stop_id
    on conflict (student_id, trip_id, kind) do nothing;

    -- That may have been the final stop; close the run in the same breath
    -- rather than waiting for a ping that may never come.
    if not exists (
      select 1 from app.trip_stop_order(new.trip_id) s
      where not exists (
        select 1 from public.trip_stop_event e
        where e.trip_id = new.trip_id and e.route_stop_id = s.stop_id and e.event = 'arrived')
    ) then
      update public.trip
         set status = 'completed', ended_at = coalesce(ended_at, now())
       where id = new.trip_id and status = 'running';
      return null;
    end if;

  elsif v_eta is not null and v_eta <= 300 then
    insert into public.trip_stop_event (trip_id, route_stop_id, event)
    values (new.trip_id, v_next.stop_id, 'approaching')
    on conflict do nothing;

    insert into public.transport_alert (student_id, trip_id, route_stop_id, kind, payload)
    select st.student_id, new.trip_id, v_next.stop_id, 'approaching',
           jsonb_build_object('stop_id', v_next.stop_id, 'eta_seconds', v_eta)
    from public.student_transport st
    where st.is_active
      and st.academic_year_id = v_assign.academic_year_id
      and st.route_id = v_assign.route_id
      and (case when v_trip.shift = 'morning' then st.pickup_stop_id else st.drop_stop_id end) = v_next.stop_id
    on conflict (student_id, trip_id, kind) do nothing;
  end if;

  -- Late, but plausibly late: 10 minutes to 2 hours (see 0027).
  select case when v_trip.shift = 'morning' then rs.sched_am else rs.sched_pm end
    into v_sched from public.route_stop rs where rs.id = v_next.stop_id;
  if v_sched is not null then
    v_delay_min := round(extract(epoch from (
      (now() at time zone 'Asia/Kolkata')::time - v_sched)) / 60)::int - coalesce(v_eta, 0) / 60;
    if v_delay_min between 10 and 120 then
      insert into public.transport_alert (student_id, trip_id, route_stop_id, kind, payload)
      select st.student_id, new.trip_id, v_next.stop_id, 'delayed',
             jsonb_build_object('delay_minutes', v_delay_min)
      from public.student_transport st
      where st.is_active
        and st.academic_year_id = v_assign.academic_year_id
        and st.route_id = v_assign.route_id
      on conflict (student_id, trip_id, kind) do nothing;
    end if;
  end if;

  return null;
end $$;

-- A manual "Arrived" on the final stop must finish the run too — otherwise a
-- conductor tapping the last stop by hand leaves the bus live forever.
create or replace function app.on_manual_stop_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_assign public.bus_assignment; v_trip public.trip;
begin
  if new.event <> 'arrived' then return null; end if;
  select * into v_trip from public.trip where id = new.trip_id;
  select * into v_assign from public.bus_assignment where id = v_trip.bus_assignment_id;

  insert into public.transport_alert (student_id, trip_id, route_stop_id, kind, payload)
  select st.student_id, new.trip_id, new.route_stop_id, 'arrived',
         jsonb_build_object('stop_id', new.route_stop_id, 'manual', new.is_manual)
  from public.student_transport st
  where st.is_active
    and st.academic_year_id = v_assign.academic_year_id
    and st.route_id = v_assign.route_id
    and (case when v_trip.shift = 'morning' then st.pickup_stop_id else st.drop_stop_id end) = new.route_stop_id
  on conflict (student_id, trip_id, kind) do nothing;

  if not exists (
    select 1 from app.trip_stop_order(new.trip_id) s
    where not exists (
      select 1 from public.trip_stop_event e
      where e.trip_id = new.trip_id and e.route_stop_id = s.stop_id and e.event = 'arrived')
  ) then
    update public.trip
       set status = 'completed', ended_at = coalesce(ended_at, now())
     where id = new.trip_id and status = 'running';
  end if;
  return null;
end $$;

-- Retire any run already sitting in the broken state: every stop arrived, still
-- flagged running.
update public.trip t
   set status = 'completed', ended_at = coalesce(t.ended_at, now())
 where t.status = 'running'
   and not exists (
     select 1 from app.trip_stop_order(t.id) s
     where not exists (
       select 1 from public.trip_stop_event e
       where e.trip_id = t.id and e.route_stop_id = s.stop_id and e.event = 'arrived'));
