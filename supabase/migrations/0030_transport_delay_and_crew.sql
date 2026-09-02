-- =============================================================================
-- Migration 0030 — Two corrections and one thing the crew were promised.
--
-- 1. The delay maths was inverted. Lateness at the NEXT stop is how far past its
--    scheduled time the bus will arrive — clock time PLUS the remaining travel,
--    measured against the timetable. 0025/0027 SUBTRACTED the ETA, so the later
--    a bus was the less late it looked, and the alert usually never fired at all.
--
-- 2. The 'delayed' alert went to every rider on the route with no stop filter,
--    unlike 'arrived' and 'approaching' — so families whose child was already
--    aboard, or already dropped, were told the bus was late for them. Now only
--    families whose stop is still ahead of the bus hear about it.
--
-- 3. A conductor cannot read student_transport (it is pupil data, and crew are
--    not in a pupil's scope), so the console's per-stop rider counts were always
--    empty. Crew do need to know how many children to expect at a stop, so they
--    get exactly that and nothing more: counts, through a SECURITY DEFINER
--    function that never returns a name.
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
  if new.accuracy_m is not null and new.accuracy_m > 150 then
    return null;
  end if;

  select * into v_trip from public.trip where id = new.trip_id;
  if v_trip.status <> 'running' then return null; end if;
  select * into v_assign from public.bus_assignment where id = v_trip.bus_assignment_id;

  select s.* into v_next
  from app.trip_stop_order(new.trip_id) s
  where not exists (
    select 1 from public.trip_stop_event e
    where e.trip_id = new.trip_id and e.route_stop_id = s.stop_id and e.event = 'arrived')
  order by s.ord
  limit 1;

  -- Every stop reached: the run is over (0029).
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

  -- Lateness at the next stop: now + the remaining travel, against the
  -- timetable. Bounded to 10..120 minutes (see 0027) so a run driven outside its
  -- schedule reports nothing rather than something false.
  select case when v_trip.shift = 'morning' then rs.sched_am else rs.sched_pm end
    into v_sched from public.route_stop rs where rs.id = v_next.stop_id;
  if v_sched is not null then
    v_delay_min := round(extract(epoch from (
      (now() at time zone 'Asia/Kolkata')::time - v_sched)) / 60)::int
      + coalesce(v_eta, 0) / 60;
    if v_delay_min between 10 and 120 then
      -- Only families still waiting for this bus. A child already picked up (or
      -- already dropped) is not waiting for anything.
      insert into public.transport_alert (student_id, trip_id, route_stop_id, kind, payload)
      select st.student_id, new.trip_id, v_next.stop_id, 'delayed',
             jsonb_build_object('delay_minutes', v_delay_min)
      from public.student_transport st
        join app.trip_stop_order(new.trip_id) s
          on s.stop_id = (case when v_trip.shift = 'morning' then st.pickup_stop_id else st.drop_stop_id end)
      where st.is_active
        and st.academic_year_id = v_assign.academic_year_id
        and st.route_id = v_assign.route_id
        and s.ord >= v_next.ord
      on conflict (student_id, trip_id, kind) do nothing;
    end if;
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------------------
-- How many children to expect at each stop — counts only, never a name. The
-- crew's own route only; anyone else gets an empty set.
-- ---------------------------------------------------------------------------
create or replace function public.crew_stop_rider_counts(p_route bigint)
returns table (route_stop_id bigint, morning_count int, afternoon_count int)
language sql stable security definer set search_path = public, pg_temp as $$
  select rs.id,
         count(*) filter (where st.pickup_stop_id = rs.id)::int,
         count(*) filter (where st.drop_stop_id = rs.id)::int
  from public.route_stop rs
    left join public.student_transport st
      on st.route_id = p_route
     and st.is_active
     and st.academic_year_id = app.current_year_id()
     and (st.pickup_stop_id = rs.id or st.drop_stop_id = rs.id)
  where rs.route_id = p_route
    and (
      app.is_admin_scope()
      or exists (
        select 1 from public.bus_assignment a
        where a.id in (select * from app.my_crew_assignments()) and a.route_id = p_route)
    )
  group by rs.id;
$$;
grant execute on function public.crew_stop_rider_counts(bigint) to authenticated, service_role;
