-- =============================================================================
-- Migration 0023 — Transport: buses, routes, stops, trips, live position
--
-- Purely additive: no existing table, policy or RPC is touched, so a portal
-- sharing this database is unaffected until it queries these tables.
--
-- Unlike the original 25 tables (single-tenant, see README), everything here
-- carries school_id from day one, so a future tenant split is a backfill of the
-- older tables only, not of these.
--
-- RLS for these tables is added in 0024_transport_security.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type trip_shift           as enum ('morning', 'afternoon');
create type trip_status          as enum ('running', 'completed', 'cancelled', 'auto_closed');
create type stop_event_kind      as enum ('approaching', 'arrived', 'departed', 'skipped');
create type transport_alert_kind as enum ('trip_started', 'approaching', 'arrived', 'delayed', 'trip_ended');

-- The school every transport row belongs to. One school per deployment today,
-- so this resolves to the single row; the column exists so it never has to be
-- backfilled later.
create or replace function app.default_school_id()
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.school order by id limit 1;
$$;
grant execute on function app.default_school_id() to authenticated, anon, service_role;

-- Trips are keyed to the school day in local time, never UTC: a 07:10 pickup
-- must belong to today's date for everyone reading it.
create or replace function app.school_today()
returns date language sql stable set search_path = public, pg_temp as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;
grant execute on function app.school_today() to authenticated, anon, service_role;

-- ===========================================================================
-- Fleet
-- ===========================================================================
create table public.bus (
  id              bigint generated always as identity primary key,
  school_id       bigint not null default app.default_school_id() references public.school(id) on delete cascade,
  code            text not null,                    -- 'BUS-01' — what parents see
  registration_no text,                             -- 'GJ 01 AB 1234'
  capacity        smallint,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, code)
);
create trigger trg_bus_updated before update on public.bus
  for each row execute function public.set_updated_at();

create table public.route (
  id          bigint generated always as identity primary key,
  school_id   bigint not null default app.default_school_id() references public.school(id) on delete cascade,
  code        text not null,                        -- 'R2'
  name        text not null,                        -- 'Satellite - Prahlad Nagar'
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, code)
);
create trigger trg_route_updated before update on public.route
  for each row execute function public.set_updated_at();

-- Ordered stops along a route. cum_distance_m is the distance from the first
-- stop, precomputed on write (0025) so ETA is arithmetic, not geometry.
create table public.route_stop (
  id             bigint generated always as identity primary key,
  route_id       bigint not null references public.route(id) on delete cascade,
  seq            smallint not null,                 -- 1 = first pickup of the morning
  name           text not null,
  landmark       text,
  lat            double precision not null,
  lng            double precision not null,
  geofence_m     integer not null default 120,      -- "the bus is at this stop" radius
  sched_am       time,                              -- scheduled pickup
  sched_pm       time,                              -- scheduled drop
  cum_distance_m integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (route_id, seq),
  check (lat between -90 and 90),
  check (lng between -180 and 180),
  check (geofence_m between 30 and 1000)
);
create index idx_stop_route_seq on public.route_stop(route_id, seq);
create trigger trg_stop_updated before update on public.route_stop
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Allotment — the transport equivalent of teacher_allotment. Year-scoped, and
-- it is what makes a conductor able to write and a parent able to read.
-- ===========================================================================
create table public.bus_assignment (
  id                 bigint generated always as identity primary key,
  bus_id             bigint not null references public.bus(id) on delete cascade,
  route_id           bigint not null references public.route(id) on delete cascade,
  academic_year_id   bigint not null references public.academic_year(id) on delete cascade,
  driver_staff_id    bigint references public.staff(id) on delete set null,
  conductor_staff_id bigint references public.staff(id) on delete set null,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (bus_id, route_id, academic_year_id)
);
create index idx_busassign_year on public.bus_assignment(academic_year_id) where is_active;
create index idx_busassign_conductor on public.bus_assignment(conductor_staff_id, academic_year_id);
create index idx_busassign_driver on public.bus_assignment(driver_staff_id, academic_year_id);
-- One active route per bus per year keeps "which bus is this trip?" unambiguous.
create unique index one_active_route_per_bus
  on public.bus_assignment(bus_id, academic_year_id) where is_active;
create trigger trg_busassign_updated before update on public.bus_assignment
  for each row execute function public.set_updated_at();

-- Which student rides which route, boarding where. Drives parent visibility.
create table public.student_transport (
  id               bigint generated always as identity primary key,
  student_id       bigint not null references public.student(id) on delete cascade,
  academic_year_id bigint not null references public.academic_year(id) on delete cascade,
  route_id         bigint not null references public.route(id) on delete cascade,
  pickup_stop_id   bigint not null references public.route_stop(id) on delete restrict,
  drop_stop_id     bigint not null references public.route_stop(id) on delete restrict,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (student_id, academic_year_id)             -- one bus arrangement per year
);
create index idx_stransport_route on public.student_transport(route_id, academic_year_id) where is_active;
create index idx_stransport_pickup on public.student_transport(pickup_stop_id);
create trigger trg_stransport_updated before update on public.student_transport
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Trips & live position
-- ===========================================================================
create table public.trip (
  id                bigint generated always as identity primary key,
  bus_assignment_id bigint not null references public.bus_assignment(id) on delete cascade,
  service_date      date not null default app.school_today(),
  shift             trip_shift not null,
  status            trip_status not null default 'running',
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  started_by        uuid references public.profile(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A double-tapped "Start trip" cannot create a second trip.
  unique (bus_assignment_id, service_date, shift),
  check (ended_at is null or ended_at >= started_at)
);
create index idx_trip_date on public.trip(service_date desc, shift);
create index idx_trip_running on public.trip(bus_assignment_id) where status = 'running';
create trigger trg_trip_updated before update on public.trip
  for each row execute function public.set_updated_at();

-- Append-only GPS breadcrumbs. captured_at is the SERVER clock (authoritative);
-- device_at is whatever the phone thought, kept only to diagnose clock drift.
-- ~10 buses x 6/min x 3h/day is small; 0025 adds a 30-day retention job.
create table public.trip_ping (
  id          bigint generated always as identity primary key,
  trip_id     bigint not null references public.trip(id) on delete cascade,
  captured_at timestamptz not null default now(),
  device_at   timestamptz,
  lat         double precision not null,
  lng         double precision not null,
  speed_kmh   real,
  heading     real,
  accuracy_m  real,
  battery_pct smallint,
  check (lat between -90 and 90),
  check (lng between -180 and 180)
);
create index idx_ping_trip_time on public.trip_ping(trip_id, captured_at desc);

-- ONE row per bus: the only thing a parent's map subscribes to — never the ping
-- firehose. Maintained by a SECURITY DEFINER trigger in 0025.
create table public.bus_live (
  bus_id          bigint primary key references public.bus(id) on delete cascade,
  trip_id         bigint references public.trip(id) on delete set null,
  route_id        bigint references public.route(id) on delete set null,
  lat             double precision,
  lng             double precision,
  speed_kmh       real,
  heading         real,
  next_stop_id    bigint references public.route_stop(id) on delete set null,
  eta_seconds     integer,                          -- to next_stop_id; null = unknown
  stops_remaining smallint,
  is_running      boolean not null default false,
  updated_at      timestamptz not null default now()
);
create index idx_buslive_running on public.bus_live(is_running) where is_running;

-- Geofence-derived arrivals/departures. The unique key makes the trigger
-- idempotent: re-entering a geofence cannot fire "arrived" twice.
create table public.trip_stop_event (
  id            bigint generated always as identity primary key,
  trip_id       bigint not null references public.trip(id) on delete cascade,
  route_stop_id bigint not null references public.route_stop(id) on delete cascade,
  event         stop_event_kind not null,
  at            timestamptz not null default now(),
  is_manual     boolean not null default false,     -- conductor tapped "Arrived"
  unique (trip_id, route_stop_id, event)
);
create index idx_stopevent_trip on public.trip_stop_event(trip_id, at);

-- Notification outbox. Rows are queued by triggers and drained by pg_cron into
-- the transport-alert Edge Function. sent_at null = still owed to a parent.
create table public.transport_alert (
  id            bigint generated always as identity primary key,
  student_id    bigint not null references public.student(id) on delete cascade,
  trip_id       bigint not null references public.trip(id) on delete cascade,
  route_stop_id bigint references public.route_stop(id) on delete set null,
  kind          transport_alert_kind not null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  channel       text,                               -- 'email' | 'push' | 'in_app'
  -- One alert of each kind per student per trip. No double "bus is coming".
  unique (student_id, trip_id, kind)
);
create index idx_alert_pending on public.transport_alert(created_at) where sent_at is null;
create index idx_alert_student on public.transport_alert(student_id, created_at desc);
