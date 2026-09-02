import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";

// Every query here runs under the caller's own session, so RLS decides what
// comes back. A guardian asking for the fleet gets their child's bus and
// nothing else — the filters below are for shape, never for security.

export type Stop = {
  id: number;
  seq: number;
  name: string;
  landmark: string | null;
  lat: number;
  lng: number;
  sched_am: string | null;
  sched_pm: string | null;
};

export type Live = {
  bus_id: number;
  trip_id: number | null;
  route_id: number | null;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  heading: number | null;
  next_stop_id: number | null;
  eta_seconds: number | null;
  stops_remaining: number | null;
  is_running: boolean;
  updated_at: string;
};

export type RiderView = {
  studentId: number;
  studentName: string;
  busId: number;
  busCode: string;
  registration: string | null;
  routeId: number;
  routeCode: string;
  routeName: string;
  pickupStopId: number;
  dropStopId: number;
  stops: Stop[];
  live: Live | null;
  arrivedStopIds: number[];
  /** The running trip's direction; the afternoon run drives the route in reverse. */
  shift: "morning" | "afternoon" | null;
  conductor: string | null;
  driver: string | null;
};

const STOP_COLS = "id, seq, name, landmark, lat, lng, sched_am, sched_pm";

/** The bus each of the caller's children rides, with its live position. */
export async function getMyRides(): Promise<RiderView[]> {
  const supabase = await createClient();
  const session = await getSession();
  const year = await getCurrentYear();
  if (!session || !year) return [];

  const { data: allots } = await supabase
    .from("student_transport")
    .select("student_id, route_id, pickup_stop_id, drop_stop_id, student:student_id(full_name)")
    .eq("academic_year_id", year.id)
    .eq("is_active", true);
  if (!allots?.length) return [];

  const routeIds = [...new Set(allots.map((a) => a.route_id))];

  const [{ data: routes }, { data: assigns }, { data: stopRows }] = await Promise.all([
    supabase.from("route").select("id, code, name").in("id", routeIds),
    supabase
      .from("bus_assignment")
      .select("id, bus_id, route_id, bus:bus_id(code, registration_no), driver:driver_staff_id(full_name), conductor:conductor_staff_id(full_name)")
      .in("route_id", routeIds)
      .eq("academic_year_id", year.id)
      .eq("is_active", true),
    supabase.from("route_stop").select(`route_id, ${STOP_COLS}`).in("route_id", routeIds).order("seq"),
  ]);

  const busIds = (assigns ?? []).map((a) => a.bus_id);
  const { data: lives } = busIds.length
    ? await supabase.from("bus_live").select("*").in("bus_id", busIds)
    : { data: [] as Live[] };

  const tripIds = (lives ?? []).map((l) => l.trip_id).filter((x): x is number => x != null);
  const { data: trips } = tripIds.length
    ? await supabase.from("trip").select("id, shift").in("id", tripIds)
    : { data: [] as { id: number; shift: "morning" | "afternoon" }[] };
  const { data: events } = tripIds.length
    ? await supabase.from("trip_stop_event").select("trip_id, route_stop_id, event").in("trip_id", tripIds).eq("event", "arrived")
    : { data: [] as { trip_id: number; route_stop_id: number; event: string }[] };

  const stopsByRoute = new Map<number, Stop[]>();
  for (const r of stopRows ?? []) {
    const { route_id, ...rest } = r as { route_id: number } & Stop;
    const list = stopsByRoute.get(route_id) ?? [];
    list.push(rest as Stop);
    stopsByRoute.set(route_id, list);
  }

  const out: RiderView[] = [];
  for (const a of allots) {
    const route = routes?.find((r) => r.id === a.route_id);
    const assign = assigns?.find((x) => x.route_id === a.route_id);
    if (!route || !assign) continue;
    const bus = assign.bus as unknown as { code: string; registration_no: string | null } | null;
    const live = (lives ?? []).find((l) => l.bus_id === assign.bus_id) ?? null;
    const student = a.student as unknown as { full_name: string } | null;
    out.push({
      studentId: a.student_id,
      studentName: student?.full_name ?? "",
      busId: assign.bus_id,
      busCode: bus?.code ?? "",
      registration: bus?.registration_no ?? null,
      routeId: route.id,
      routeCode: route.code,
      routeName: route.name,
      pickupStopId: a.pickup_stop_id,
      dropStopId: a.drop_stop_id,
      stops: stopsByRoute.get(route.id) ?? [],
      live: (live as Live) ?? null,
      arrivedStopIds: (events ?? []).filter((e) => e.trip_id === live?.trip_id).map((e) => e.route_stop_id),
      shift: (trips ?? []).find((t) => t.id === live?.trip_id)?.shift ?? null,
      conductor: (assign.conductor as unknown as { full_name: string } | null)?.full_name ?? null,
      driver: (assign.driver as unknown as { full_name: string } | null)?.full_name ?? null,
    });
  }
  return out;
}

export type FleetRow = {
  assignmentId: number;
  busId: number;
  busCode: string;
  registration: string | null;
  routeId: number;
  routeCode: string;
  routeName: string;
  conductor: string | null;
  driver: string | null;
  riders: number;
  stops: Stop[];
  live: Live | null;
  nextStopName: string | null;
};

/** Every bus, for office and principal. */
export async function getFleet(): Promise<FleetRow[]> {
  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) return [];

  const { data: assigns } = await supabase
    .from("bus_assignment")
    .select("id, bus_id, route_id, bus:bus_id(code, registration_no), route:route_id(code, name), driver:driver_staff_id(full_name), conductor:conductor_staff_id(full_name)")
    .eq("academic_year_id", year.id)
    .eq("is_active", true);
  if (!assigns?.length) return [];

  const routeIds = assigns.map((a) => a.route_id);
  const [{ data: lives }, { data: stopRows }, { data: riders }] = await Promise.all([
    supabase.from("bus_live").select("*").in("bus_id", assigns.map((a) => a.bus_id)),
    supabase.from("route_stop").select(`route_id, ${STOP_COLS}`).in("route_id", routeIds).order("seq"),
    supabase.from("student_transport").select("route_id").eq("academic_year_id", year.id).eq("is_active", true),
  ]);

  const stopsByRoute = new Map<number, Stop[]>();
  for (const r of stopRows ?? []) {
    const { route_id, ...rest } = r as { route_id: number } & Stop;
    const list = stopsByRoute.get(route_id) ?? [];
    list.push(rest as Stop);
    stopsByRoute.set(route_id, list);
  }

  return assigns.map((a) => {
    const live = ((lives ?? []) as Live[]).find((l) => l.bus_id === a.bus_id) ?? null;
    const stops = stopsByRoute.get(a.route_id) ?? [];
    const bus = a.bus as unknown as { code: string; registration_no: string | null } | null;
    const route = a.route as unknown as { code: string; name: string } | null;
    return {
      assignmentId: a.id,
      busId: a.bus_id,
      busCode: bus?.code ?? "",
      registration: bus?.registration_no ?? null,
      routeId: a.route_id,
      routeCode: route?.code ?? "",
      routeName: route?.name ?? "",
      conductor: (a.conductor as unknown as { full_name: string } | null)?.full_name ?? null,
      driver: (a.driver as unknown as { full_name: string } | null)?.full_name ?? null,
      riders: (riders ?? []).filter((r) => r.route_id === a.route_id).length,
      stops,
      live,
      nextStopName: stops.find((s) => s.id === live?.next_stop_id)?.name ?? null,
    };
  });
}

export type CrewContext = {
  assignmentId: number;
  busId: number;
  busCode: string;
  registration: string | null;
  routeCode: string;
  routeName: string;
  stops: Stop[];
  riderCountByStop: Record<number, number>;
  /** The same counts for the afternoon run, where the drop stop is what matters. */
  riderDropCountByStop: Record<number, number>;
  openTrip: { id: number; shift: "morning" | "afternoon"; started_at: string } | null;
  arrivedStopIds: number[];
};

/** What the conductor's phone needs: one bus, its stops, today's open trip. */
export async function getCrewContext(): Promise<CrewContext | null> {
  const supabase = await createClient();
  const session = await getSession();
  const year = await getCurrentYear();
  if (!session?.staffId || !year) return null;

  const { data: assign } = await supabase
    .from("bus_assignment")
    .select("id, bus_id, route_id, bus:bus_id(code, registration_no), route:route_id(code, name)")
    .eq("academic_year_id", year.id)
    .eq("is_active", true)
    .or(`conductor_staff_id.eq.${session.staffId},driver_staff_id.eq.${session.staffId}`)
    .maybeSingle();
  if (!assign) return null;

  const [{ data: stops }, { data: riders }, { data: trip }] = await Promise.all([
    supabase.from("route_stop").select(STOP_COLS).eq("route_id", assign.route_id).order("seq"),
    // Counts only, never names: crew are not in a pupil's scope (see 0030).
    supabase.rpc("crew_stop_rider_counts", { p_route: assign.route_id }),
    // A bus can legitimately have two running trips (a morning run the crew
    // forgot to end, and today's afternoon one), so take the most recent rather
    // than asking for exactly one and erroring when there are two.
    supabase.from("trip").select("id, shift, started_at").eq("bus_assignment_id", assign.id)
      .eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const { data: events } = trip
    ? await supabase.from("trip_stop_event").select("route_stop_id").eq("trip_id", trip.id).eq("event", "arrived")
    : { data: [] as { route_stop_id: number }[] };

  const riderCountByStop: Record<number, number> = {};
  const riderDropCountByStop: Record<number, number> = {};
  for (const r of (riders ?? []) as { route_stop_id: number; morning_count: number; afternoon_count: number }[]) {
    riderCountByStop[r.route_stop_id] = r.morning_count;
    riderDropCountByStop[r.route_stop_id] = r.afternoon_count;
  }

  const bus = assign.bus as unknown as { code: string; registration_no: string | null } | null;
  const route = assign.route as unknown as { code: string; name: string } | null;
  return {
    assignmentId: assign.id,
    busId: assign.bus_id,
    busCode: bus?.code ?? "",
    registration: bus?.registration_no ?? null,
    routeCode: route?.code ?? "",
    routeName: route?.name ?? "",
    stops: (stops ?? []) as Stop[],
    riderCountByStop,
    riderDropCountByStop,
    openTrip: (trip as CrewContext["openTrip"]) ?? null,
    arrivedStopIds: (events ?? []).map((e) => e.route_stop_id),
  };
}

// ---------------------------------------------------------------------------
// Dashboard summaries
// ---------------------------------------------------------------------------

export type RideSummary = {
  studentId: number;
  studentName: string;
  /** The bus itself, so a card can subscribe to bus_live without a second query. */
  busId: number | null;
  busCode: string;
  routeCode: string;
  routeName: string;
  /** The pupil's own boarding stop — the only stop a family cares about. */
  stopId: number;
  stopName: string;
  schedAm: string | null;
  schedPm: string | null;
  isRunning: boolean;
  etaSeconds: number | null;
  /** The stop the ETA actually belongs to. Only the pupil's own ETA may be
      shown as theirs; see transport-card.tsx. */
  nextStopId: number | null;
  nextStopName: string | null;
  stopsRemaining: number | null;
  updatedAt: string | null;
};

/**
 * One compact line per child for dashboard cards — no stop list, no map.
 * `studentIds` narrows a guardian with several children to one card; RLS still
 * decides what may be read, so passing another family's id yields nothing.
 */
export async function getRideSummaries(studentIds?: number[]): Promise<RideSummary[]> {
  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) return [];
  if (studentIds && studentIds.length === 0) return [];

  let q = supabase
    .from("student_transport")
    .select("student_id, route_id, pickup_stop_id, student:student_id(full_name), route:route_id(code, name)")
    .eq("academic_year_id", year.id)
    .eq("is_active", true);
  if (studentIds) q = q.in("student_id", studentIds);
  const { data: allots } = await q;
  if (!allots?.length) return [];

  const routeIds = [...new Set(allots.map((a) => a.route_id))];
  const [{ data: assigns }, { data: stopRows }] = await Promise.all([
    supabase
      .from("bus_assignment")
      .select("bus_id, route_id, bus:bus_id(code)")
      .in("route_id", routeIds)
      .eq("academic_year_id", year.id)
      .eq("is_active", true),
    supabase.from("route_stop").select("id, route_id, name, sched_am, sched_pm").in("route_id", routeIds),
  ]);

  const busIds = [...new Set((assigns ?? []).map((a) => a.bus_id))];
  const { data: lives } = busIds.length
    ? await supabase.from("bus_live").select("*").in("bus_id", busIds)
    : { data: [] as Live[] };

  type StopLite = { id: number; route_id: number; name: string; sched_am: string | null; sched_pm: string | null };
  const stops = (stopRows ?? []) as StopLite[];

  const out: RideSummary[] = [];
  for (const a of allots) {
    const route = a.route as unknown as { code: string; name: string } | null;
    const assign = (assigns ?? []).find((x) => x.route_id === a.route_id);
    // No bus on this route yet: there is nothing truthful to show, and a card
    // with a blank code would neither poll nor subscribe.
    if (!assign) continue;
    const live = assign ? (((lives ?? []) as Live[]).find((l) => l.bus_id === assign.bus_id) ?? null) : null;
    const mine = stops.find((s) => s.id === a.pickup_stop_id);
    const student = a.student as unknown as { full_name: string } | null;
    const bus = assign?.bus as unknown as { code: string } | null | undefined;
    out.push({
      studentId: a.student_id,
      studentName: student?.full_name ?? "",
      busId: assign?.bus_id ?? null,
      busCode: bus?.code ?? "",
      routeCode: route?.code ?? "",
      routeName: route?.name ?? "",
      stopId: a.pickup_stop_id,
      stopName: mine?.name ?? "",
      schedAm: mine?.sched_am ?? null,
      schedPm: mine?.sched_pm ?? null,
      isRunning: live?.is_running ?? false,
      etaSeconds: live?.eta_seconds ?? null,
      nextStopId: live?.next_stop_id ?? null,
      nextStopName: stops.find((s) => s.id === live?.next_stop_id)?.name ?? null,
      stopsRemaining: live?.stops_remaining ?? null,
      updatedAt: live?.updated_at ?? null,
    });
  }
  return out;
}

export type FleetSummary = {
  /** Buses in service this year (active bus_assignment rows), not the whole yard. */
  buses: number;
  running: number;
  riders: number;
  /** Claiming to run but silent for over five minutes — a phone that died. */
  stale: number;
};

const STALE_MS = 5 * 60 * 1000;

/** Four numbers for a staff dashboard tile. Zeroes when nothing is set up. */
export async function getFleetSummary(): Promise<FleetSummary> {
  const supabase = await createClient();
  const year = await getCurrentYear();
  const empty: FleetSummary = { buses: 0, running: 0, riders: 0, stale: 0 };
  if (!year) return empty;

  const [{ data: assigns }, { count: riders }] = await Promise.all([
    supabase.from("bus_assignment").select("bus_id").eq("academic_year_id", year.id).eq("is_active", true),
    supabase
      .from("student_transport")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id", year.id)
      .eq("is_active", true),
  ]);

  const busIds = [...new Set((assigns ?? []).map((a) => a.bus_id))];
  if (!busIds.length) return { ...empty, riders: riders ?? 0 };

  const { data: lives } = await supabase
    .from("bus_live")
    .select("bus_id, is_running, updated_at")
    .in("bus_id", busIds);

  const now = Date.now();
  const live = (lives ?? []) as { bus_id: number; is_running: boolean; updated_at: string }[];
  return {
    buses: busIds.length,
    running: live.filter((l) => l.is_running).length,
    riders: riders ?? 0,
    stale: live.filter((l) => l.is_running && now - new Date(l.updated_at).getTime() > STALE_MS).length,
  };
}

// ---------------------------------------------------------------------------
// Office: allotting pupils to buses
// ---------------------------------------------------------------------------

export type RouteWithStops = { id: number; code: string; name: string; stops: Stop[] };

export type RiderRow = {
  /** student_transport.id — what updateTransport and removeTransport take. */
  id: number;
  studentId: number;
  studentName: string;
  admissionNo: string;
  classSection: string | null;
  routeId: number;
  routeCode: string;
  routeName: string;
  pickupStopId: number;
  pickupStopName: string;
  dropStopId: number;
  dropStopName: string;
};

export type UnassignedPupil = {
  studentId: number;
  studentName: string;
  admissionNo: string;
  classSection: string | null;
};

export type RiderAdmin = {
  routes: RouteWithStops[];
  riders: RiderRow[];
  /** Riders matching the filter across all pages, so the UI can page. */
  total: number;
  page: number;
  pageSize: number;
  unassigned: UnassignedPupil[];
  /** Unassigned pupils matching q in full; `unassigned` is one page of them. */
  unassignedTotal: number;
  unassignedPage: number;
  unassignedPageSize: number;
};

// Above any plausible roster, so a search never reports a truncated total.
const SEARCH_CAP = 5000;
export const RIDER_PAGE_SIZE = 50;
const UNASSIGNED_CAP = 50;
// PostgREST caps a single response, so the roster is pulled in slices: diffing
// enrolled against allotted must not silently lose the tail at a big school.
const SCAN_CHUNK = 1000;

/** Everything the rider-admin screen needs, in one round of queries. */
export async function getRiderAdmin(
  opts: { q?: string; routeId?: number | null; page?: number; unassignedPage?: number } = {},
): Promise<RiderAdmin> {
  const supabase = await createClient();
  const year = await getCurrentYear();
  const page = Math.max(0, opts.page ?? 0);
  const unassignedPage = Math.max(0, opts.unassignedPage ?? 0);
  const q = (opts.q ?? "").trim();
  const empty: RiderAdmin = {
    routes: [], riders: [], total: 0, page, pageSize: RIDER_PAGE_SIZE,
    unassigned: [], unassignedTotal: 0, unassignedPage, unassignedPageSize: UNASSIGNED_CAP,
  };
  if (!year) return empty;

  const [{ data: routeRows }, { data: stopRows }] = await Promise.all([
    supabase.from("route").select("id, code, name").eq("is_active", true).order("code"),
    supabase.from("route_stop").select(`route_id, ${STOP_COLS}`).order("seq"),
  ]);

  const stopsByRoute = new Map<number, Stop[]>();
  for (const r of stopRows ?? []) {
    const { route_id, ...rest } = r as { route_id: number } & Stop;
    const list = stopsByRoute.get(route_id) ?? [];
    list.push(rest as Stop);
    stopsByRoute.set(route_id, list);
  }
  const routes: RouteWithStops[] = (routeRows ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    stops: stopsByRoute.get(r.id) ?? [],
  }));

  // A search term is resolved to student ids first: PostgREST cannot filter a
  // parent row on an embedded table's columns, and the unassigned list needs
  // exactly the same id set anyway.
  let matchIds: number[] | null = null;
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    // Double-quoted so a comma or a dot in the term is data, not PostgREST
    // syntax; the inner quote is escaped for the same reason.
    const quoted = `"${pattern.replace(/"/g, '\\"')}"`;
    const { data: found } = await supabase
      .from("student")
      .select("id")
      .or(`full_name.ilike.${quoted},admission_no.ilike.${quoted}`)
      .order("full_name")
      .limit(SEARCH_CAP);
    matchIds = (found ?? []).map((s) => s.id);
    if (!matchIds.length) return { ...empty, routes };
  }

  // PostgREST cannot sort a parent row by an embedded column, so the alphabet
  // is resolved on the student table first and the page is cut from THAT order.
  // Sorting only within a fetched page made every page restart at "A", which
  // made paging toward a pupil impossible.
  let idQ = supabase
    .from("student_transport")
    .select("student_id")
    .eq("academic_year_id", year.id)
    .eq("is_active", true);
  if (opts.routeId) idQ = idQ.eq("route_id", opts.routeId);
  if (matchIds) idQ = idQ.in("student_id", matchIds);
  const scopedIds: number[] = [];
  for (let from = 0; ; from += SCAN_CHUNK) {
    const { data } = await idQ.range(from, from + SCAN_CHUNK - 1);
    for (const r of data ?? []) scopedIds.push(r.student_id);
    if (!data || data.length < SCAN_CHUNK) break;
  }
  const total = scopedIds.length;

  const ordered: number[] = [];
  for (let from = 0; from < scopedIds.length; from += SCAN_CHUNK) {
    const { data } = await supabase
      .from("student")
      .select("id")
      .in("id", scopedIds.slice(from, from + SCAN_CHUNK))
      .order("full_name");
    for (const r of data ?? []) ordered.push(r.id);
  }
  const pageIdsOrdered = ordered.slice(page * RIDER_PAGE_SIZE, page * RIDER_PAGE_SIZE + RIDER_PAGE_SIZE);

  let ridersQ = supabase
    .from("student_transport")
    .select(
      "id, student_id, route_id, pickup_stop_id, drop_stop_id, student:student_id(full_name, admission_no), route:route_id(code, name)",
    )
    .eq("academic_year_id", year.id)
    .eq("is_active", true);
  // -1 matches nothing, which keeps one query shape (and one row type) rather
  // than branching on an empty page.
  ridersQ = ridersQ.in("student_id", pageIdsOrdered.length ? pageIdsOrdered : [-1]);
  const { data: riderRows } = await ridersQ;

  const stopName = (id: number) => {
    for (const list of stopsByRoute.values()) {
      const s = list.find((x) => x.id === id);
      if (s) return s.name;
    }
    return "";
  };

  // Class labels for this page's pupils only; the roster scan further down is
  // for the unassigned pool and would be wasteful here.
  const pageIds = (riderRows ?? []).map((r) => r.student_id);
  const labels = new Map<number, string | null>();
  if (pageIds.length) {
    const { data: enr } = await supabase
      .from("student_enrollment")
      .select("student_id, section:section_id(name, class:class_id(name))")
      .eq("academic_year_id", year.id)
      .in("student_id", pageIds);
    for (const e of enr ?? []) labels.set(e.student_id, sectionLabel(e.section));
  }

  const riders: RiderRow[] = (riderRows ?? [])
    .map((r) => {
      const student = r.student as unknown as { full_name: string; admission_no: string } | null;
      const route = r.route as unknown as { code: string; name: string } | null;
      return {
        id: r.id,
        studentId: r.student_id,
        studentName: student?.full_name ?? "",
        admissionNo: student?.admission_no ?? "",
        classSection: labels.get(r.student_id) ?? null,
        routeId: r.route_id,
        routeCode: route?.code ?? "",
        routeName: route?.name ?? "",
        pickupStopId: r.pickup_stop_id,
        pickupStopName: stopName(r.pickup_stop_id),
        dropStopId: r.drop_stop_id,
        dropStopName: stopName(r.drop_stop_id),
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  // Enrolled this year but riding nothing: the pool the office allots from.
  const allotted = new Set<number>();
  for (let from = 0; ; from += SCAN_CHUNK) {
    const { data } = await supabase
      .from("student_transport")
      .select("student_id")
      .eq("academic_year_id", year.id)
      .eq("is_active", true)
      .range(from, from + SCAN_CHUNK - 1);
    for (const r of data ?? []) allotted.add(r.student_id);
    if (!data || data.length < SCAN_CHUNK) break;
  }

  const unassigned: UnassignedPupil[] = [];
  let unassignedTotal = 0;
  for (let from = 0; ; from += SCAN_CHUNK) {
    let enrQ = supabase
      .from("student_enrollment")
      .select("student_id, student:student_id(full_name, admission_no), section:section_id(name, class:class_id(name))")
      .eq("academic_year_id", year.id)
      .eq("status", "active");
    if (matchIds) enrQ = enrQ.in("student_id", matchIds);
    const { data } = await enrQ.order("student_id").range(from, from + SCAN_CHUNK - 1);
    for (const e of data ?? []) {
      if (allotted.has(e.student_id)) continue;
      const index = unassignedTotal;
      unassignedTotal++;
      const from_ = unassignedPage * UNASSIGNED_CAP;
      if (index < from_ || index >= from_ + UNASSIGNED_CAP) continue;
      const student = e.student as unknown as { full_name: string; admission_no: string } | null;
      unassigned.push({
        studentId: e.student_id,
        studentName: student?.full_name ?? "",
        admissionNo: student?.admission_no ?? "",
        classSection: sectionLabel(e.section),
      });
    }
    if (!data || data.length < SCAN_CHUNK) break;
  }
  unassigned.sort((a, b) => a.studentName.localeCompare(b.studentName));

  return { routes, riders, total: total ?? 0, page, pageSize: RIDER_PAGE_SIZE, unassigned, unassignedTotal, unassignedPage, unassignedPageSize: UNASSIGNED_CAP };
}

/** "VIII-A" from an embedded section row; a section need not sit under a class. */
function sectionLabel(section: unknown): string | null {
  const sec = section as { name: string; class: { name: string } | null } | null;
  if (!sec) return null;
  return sec.class ? `${sec.class.name}-${sec.name}` : sec.name;
}
