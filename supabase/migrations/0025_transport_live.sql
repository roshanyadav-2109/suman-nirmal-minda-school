-- =============================================================================
-- Migration 0025 — Transport live engine: distances, ETA, geofence, alerts,
-- the jobs that clean up after a forgetful conductor, and Realtime.
--
-- Everything here is server-side on purpose. A phone reports where it is and
-- nothing more; what that MEANS — which stop is next, how long it will take,
-- whether a parent gets told — is decided in the database, where it cannot be
-- spoofed by a client and cannot drift between the app and the map.
--
-- No PostGIS: haversine on the stop coordinates is accurate to a few metres at
-- city scale, and the whole route is one small ordered list.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Geometry
-- ---------------------------------------------------------------------------
create or replace function app.haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;
grant execute on function app.haversine_m(double precision, double precision, double precision, double precision)
  to authenticated, anon, service_role;

-- Straight-line distance understates road distance in a grid city. 1.3 is the
-- usual detour factor for Indian arterial layouts and keeps ETA honest-ish.
create or replace function app.road_m(p_straight double precision)
returns double precision language sql immutable parallel safe as $$
  select p_straight * 1.3;
$$;
grant execute on function app.road_m(double precision) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- cum_distance_m is derived data: recompute it whenever a stop moves, is added
-- or is removed, so an office edit can never leave stale distances behind.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_route_distances(p_route bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  with ordered as (
    select id, seq, lat, lng,
           lag(lat) over (order by seq) plat,
           lag(lng) over (order by seq) plng
    from public.route_stop where route_id = p_route
  ), legs as (
    select id, seq,
           coalesce(app.haversine_m(plat, plng, lat, lng), 0) leg
    from ordered
  ), cum as (
    select id, round(sum(leg) over (order by seq rows between unbounded preceding and current row))::int d
    from legs
  )
  update public.route_stop rs set cum_distance_m = cum.d
  from cum where cum.id = rs.id and rs.cum_distance_m is distinct from cum.d;
end $$;

create or replace function app.on_route_stop_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Depth guard: the recompute UPDATEs route_stop and would re-enter here.
  if pg_trigger_depth() > 1 then return null; end if;
  perform public.recompute_route_distances(coalesce(new.route_id, old.route_id));
  return null;
end $$;

create trigger trg_stop_distances
  after insert or update of lat, lng, seq or delete on public.route_stop
  for each row execute function app.on_route_stop_change();

-- ---------------------------------------------------------------------------
-- Where is the bus, really?
--
-- Progress is tracked by ARRIVAL EVENTS, not by nearest-stop guessing: the next
-- stop is simply the first one this trip has not arrived at yet. That survives
-- a bus doubling back, a GPS jump, and a tunnel — none of which can make the
-- route run backwards.
--
-- Morning runs stops in seq order; afternoon runs them in reverse.
-- ---------------------------------------------------------------------------
create or replace function app.trip_stop_order(p_trip bigint)
returns table (stop_id bigint, ord int, lat double precision, lng double precision,
               geofence_m int, cum_distance_m int)
language sql stable security definer set search_path = public, pg_temp as $$
  select rs.id,
         (row_number() over (order by case when t.shift = 'morning' then rs.seq else -rs.seq end))::int,
         rs.lat, rs.lng, rs.geofence_m, rs.cum_distance_m
  from public.trip t
    join public.bus_assignment a on a.id = t.bus_assignment_id
    join public.route_stop rs on rs.route_id = a.route_id
  where t.id = p_trip;
$$;

-- The heart of it: called for every accepted ping.
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

    -- Rolling speed over the last five minutes, floored so a bus stuck at a
    -- light does not produce an ETA of four hours. Default 18 km/h city speed.
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

  -- One row per bus: this is what the parent's map subscribes to.
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

  -- Inside the geofence: the bus has arrived. The unique key on
  -- (trip, stop, event) makes re-entering the circle a no-op.
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

  -- Five minutes out: tell the families waiting at that stop, once.
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

  -- Running more than ten minutes behind the timetable for this stop: say so,
  -- once per trip, to everyone still waiting on this bus.
  select case when v_trip.shift = 'morning' then rs.sched_am else rs.sched_pm end
    into v_sched from public.route_stop rs where rs.id = v_next.stop_id;
  if v_sched is not null then
    v_delay_min := round(extract(epoch from (
      (now() at time zone 'Asia/Kolkata')::time - v_sched)) / 60)::int - coalesce(v_eta, 0) / 60;
    if v_delay_min >= 10 then
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

create trigger trg_ping_live
  after insert on public.trip_ping
  for each row execute function app.on_trip_ping();

-- A trip that ends must stop pretending to be live.
create or replace function app.on_trip_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status <> 'running' then
    update public.bus_live bl
      set is_running = false, eta_seconds = null, next_stop_id = null, updated_at = now()
    where bl.trip_id = new.id;
  end if;
  return null;
end $$;

create trigger trg_trip_status
  after update of status on public.trip
  for each row when (old.status is distinct from new.status)
  execute function app.on_trip_status();

-- ---------------------------------------------------------------------------
-- Manual "Arrived" from the conductor advances the trip exactly like a geofence
-- crossing would, so a bad-GPS day never strands the whole route.
-- ---------------------------------------------------------------------------
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
  return null;
end $$;

create trigger trg_manual_stop_event
  after insert on public.trip_stop_event
  for each row when (new.is_manual)
  execute function app.on_manual_stop_event();

-- ---------------------------------------------------------------------------
-- Housekeeping. Conductors forget to press End; phones die mid-route.
-- ---------------------------------------------------------------------------
create or replace function public.end_stale_trips()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  with stale as (
    select t.id from public.trip t
    where t.status = 'running'
      and (
        t.started_at < now() - interval '4 hours'
        or coalesce((select max(p.captured_at) from public.trip_ping p where p.trip_id = t.id),
                    t.started_at) < now() - interval '45 minutes'
      )
  )
  update public.trip t set status = 'auto_closed', ended_at = now()
  from stale where stale.id = t.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Breadcrumbs are operational data, not a record to keep. Thirty days is enough
-- to investigate an incident; after that the trail of where children were is
-- deleted rather than retained.
create or replace function public.purge_old_pings()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  delete from public.trip_ping where captured_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

do $$ begin perform cron.unschedule('transport-close-stale'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('transport-purge-pings'); exception when others then null; end $$;
select cron.schedule('transport-close-stale', '*/10 * * * *', $$select public.end_stale_trips();$$);
select cron.schedule('transport-purge-pings', '30 2 * * *',   $$select public.purge_old_pings();$$);

-- ---------------------------------------------------------------------------
-- Realtime: parents subscribe to their own bus's row. RLS still applies —
-- Supabase evaluates the SELECT policy per subscriber, so a socket cannot leak
-- a bus a family has no child on.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.bus_live;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.trip_stop_event;
exception when duplicate_object then null;
end $$;

-- bus_live carries no old-row identity by default; parents need the full new row.
alter table public.bus_live replica identity full;
