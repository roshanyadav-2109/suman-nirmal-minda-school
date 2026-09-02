-- =============================================================================
-- Migration 0027 — Bound the "bus is running late" alert.
--
-- 0025 raised a delay alert whenever the clock was more than ten minutes past a
-- stop's scheduled time. That is right for a late bus and wrong for everything
-- else: a trip driven outside its timetable (a test run, a rescheduled
-- excursion, a phone with a skewed clock) reported the bus as hours late and
-- queued an alert for every family on the route.
--
-- A bus that is genuinely late is late by minutes, not by hours. Beyond two
-- hours the number is not a delay, it is a sign the trip is not running to this
-- timetable at all — so say nothing rather than say something false.
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

  if v_next.stop_id is not null then
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
  end if;

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

  if v_next.stop_id is null then return null; end if;

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

  -- Late, but plausibly late: 10 minutes to 2 hours. See the header.
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
