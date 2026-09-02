// =============================================================================
// Transport seed — buses, routes, stops, crew, and who rides which bus.
//
// Runs entirely over the PostgREST data API with the service-role key from
// .env.local (no Management API token needed).  node scripts/seed-transport.mjs
//
// Idempotent: every run tears the transport data down and rebuilds it, so it is
// safe to re-run after editing a route.
//
// Stop coordinates are approximate neighbourhood centroids in Ahmedabad, good
// enough to demonstrate geofencing and ETA. They are NOT surveyed bus stops.
// =============================================================================
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const BASE = `${URL_BASE}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function sel(path) {
  const out = [], step = 1000;
  for (let off = 0; ; off += step) {
    const r = await fetch(`${BASE}/${path}${path.includes("?") ? "&" : "?"}limit=${step}&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${await r.text()}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}
async function ins(table, rows, ret = false, batch = 1000) {
  const out = [];
  for (let i = 0; i < rows.length; i += batch) {
    const r = await fetch(`${BASE}/${table}`, { method: "POST",
      headers: { ...H, Prefer: ret ? "return=representation" : "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + batch)) });
    if (!r.ok) throw new Error(`INSERT ${table} → ${r.status} ${(await r.text()).slice(0, 400)}`);
    if (ret) out.push(...await r.json());
  }
  return out;
}
async function del(table, filter) {
  const r = await fetch(`${BASE}/${table}?${filter}`, { method: "DELETE", headers: H });
  if (!r.ok) throw new Error(`DELETE ${table} → ${r.status} ${(await r.text()).slice(0, 300)}`);
}

// Metres between two lat/lng points (the same haversine the ETA trigger uses).
const R_EARTH = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function metres(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_EARTH * Math.asin(Math.sqrt(h)));
}
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00`;

// ---------------------------------------------------------------------------
// The school gate — the last stop of every morning route, the first of every
// afternoon one. Override with SCHOOL_LAT / SCHOOL_LNG once surveyed.
// ---------------------------------------------------------------------------
const SCHOOL = {
  name: "School Gate",
  lat: Number(process.env.SCHOOL_LAT ?? 23.0466),
  lng: Number(process.env.SCHOOL_LNG ?? 72.5000),
};

// Four routes fanning in from the four sides of the city. Each entry is a stop
// in pickup order; the school gate is appended automatically.
const ROUTES = [
  { code: "R1", name: "Satellite — Prahlad Nagar", bus: "BUS-01", firstPickup: 6 * 60 + 40, stops: [
    { name: "Prahlad Nagar Garden", landmark: "Opp. Sarkhej-Gandhinagar Hwy", lat: 23.0107, lng: 72.5089 },
    { name: "Anand Nagar Cross Road", landmark: "Near Shell Petrol Pump", lat: 23.0146, lng: 72.5215 },
    { name: "Satellite Cross Road", landmark: "Jodhpur Char Rasta", lat: 23.0300, lng: 72.5100 },
    { name: "Shivranjani Cross Road", landmark: "Bus Rapid Transit stand", lat: 23.0290, lng: 72.5310 },
    { name: "Vastrapur Lake", landmark: "Lake main gate", lat: 23.0367, lng: 72.5300 },
  ]},
  { code: "R2", name: "Bodakdev — Thaltej", bus: "BUS-02", firstPickup: 6 * 60 + 45, stops: [
    { name: "Bopal Circle", landmark: "Ambli-Bopal Road", lat: 23.0330, lng: 72.4700 },
    { name: "Ambli Village", landmark: "Near village square", lat: 23.0345, lng: 72.4880 },
    { name: "Bodakdev Judges Bungalow", landmark: "Judges Bungalow Road", lat: 23.0395, lng: 72.5066 },
    { name: "Thaltej Cross Road", landmark: "Under the flyover", lat: 23.0500, lng: 72.5100 },
    { name: "Sola Bridge", landmark: "Science City Road junction", lat: 23.0620, lng: 72.5180 },
  ]},
  { code: "R3", name: "Navrangpura — Naranpura", bus: "BUS-03", firstPickup: 6 * 60 + 35, stops: [
    { name: "Paldi Char Rasta", landmark: "Near Bhatta crossing", lat: 23.0130, lng: 72.5680 },
    { name: "Navrangpura Bus Stand", landmark: "Opp. municipal market", lat: 23.0380, lng: 72.5600 },
    { name: "Stadium Cross Road", landmark: "Sardar Patel Stadium gate", lat: 23.0430, lng: 72.5570 },
    { name: "Naranpura Cross Road", landmark: "Near town hall", lat: 23.0570, lng: 72.5580 },
    { name: "Akhbar Nagar Circle", landmark: "Nava Vadaj side", lat: 23.0620, lng: 72.5670 },
    { name: "Gota Cross Road", landmark: "SG Highway service road", lat: 23.1000, lng: 72.5300 },
  ]},
  { code: "R4", name: "Maninagar — Nikol", bus: "BUS-04", firstPickup: 6 * 60 + 25, stops: [
    { name: "Maninagar Station", landmark: "Railway station east gate", lat: 22.9960, lng: 72.6020 },
    { name: "Kankaria Lake", landmark: "Lakefront gate 3", lat: 22.9990, lng: 72.6000 },
    { name: "Amraiwadi Circle", landmark: "Near Rabari Colony", lat: 23.0140, lng: 72.6270 },
    { name: "Nikol Gam Road", landmark: "Nikol village square", lat: 23.0500, lng: 72.6600 },
    { name: "Naroda Patiya", landmark: "Naroda Road junction", lat: 23.0680, lng: 72.6350 },
  ]},
];

const BUSES = [
  { code: "BUS-01", registration_no: "GJ 01 CX 4412", capacity: 52 },
  { code: "BUS-02", registration_no: "GJ 01 CX 4413", capacity: 52 },
  { code: "BUS-03", registration_no: "GJ 01 CX 4414", capacity: 44 },
  { code: "BUS-04", registration_no: "GJ 01 CX 4415", capacity: 44 },
];

// Crew: one driver + one conductor per bus. staff.role = 'transport' (0022).
const CREW = [
  { code: "TRD01", name: "Mr. Bhavesh Chauhan", kind: "driver",    bus: "BUS-01" },
  { code: "TRC01", name: "Mr. Iqbal Sheikh",    kind: "conductor", bus: "BUS-01" },
  { code: "TRD02", name: "Mr. Dinesh Rathod",   kind: "driver",    bus: "BUS-02" },
  { code: "TRC02", name: "Mrs. Hetal Solanki",  kind: "conductor", bus: "BUS-02" },
  { code: "TRD03", name: "Mr. Suresh Parmar",   kind: "driver",    bus: "BUS-03" },
  { code: "TRC03", name: "Mr. Ramesh Vaghela",  kind: "conductor", bus: "BUS-03" },
  { code: "TRD04", name: "Mr. Jayesh Makwana",  kind: "driver",    bus: "BUS-04" },
  { code: "TRC04", name: "Mrs. Nirmala Desai",  kind: "conductor", bus: "BUS-04" },
];

const CONDUCTOR_DEMO = { email: "conductor@kv.demo", staff: "TRC03", password: "kviit@demo1" };

// ---------------------------------------------------------------------------
console.log("Loading school context…");
const [year] = await sel("academic_year?select=id,name&is_current=is.true");
if (!year) throw new Error("no current academic year — seed the school first");
const enrolled = await sel(`student_enrollment?select=student_id&academic_year_id=eq.${year.id}`);
console.log(`  session ${year.name}, ${enrolled.length} pupils enrolled`);

// --- Tear down any previous transport build (children first) ----------------
console.log("Clearing previous transport data…");
for (const t of ["trip_ping", "trip_stop_event", "transport_alert"]) await del(t, "id=gt.0");
await del("bus_live", "bus_id=gt.0");
await del("trip", "id=gt.0");
await del("student_transport", "id=gt.0");
await del("bus_assignment", "id=gt.0");
await del("route_stop", "id=gt.0");
await del("route", "id=gt.0");
await del("bus", "id=gt.0");
// The conductor's login points at a crew staff row. profile.staff_id is ON
// DELETE SET NULL, but profile_check requires a 'staff' profile to keep a staff
// link — so the profile has to go first or the staff delete fails. The auth
// user survives; the profile is rebuilt at the end of this script.
const crewOld = await sel("staff?select=id&employee_code=like.TR*");
for (const s of crewOld) await del("profile", `staff_id=eq.${s.id}`);
await del("staff", "employee_code=like.TR*");

// --- Fleet & crew ------------------------------------------------------------
console.log("Creating fleet and crew…");
const buses = await ins("bus", BUSES, true);
const busByCode = Object.fromEntries(buses.map((b) => [b.code, b]));
const crew = await ins("staff", CREW.map((c) => ({
  employee_code: c.code, full_name: c.name, role: "transport",
  email: `${c.code.toLowerCase()}@kv.demo`, phone: null,
})), true);
const crewByCode = Object.fromEntries(crew.map((s) => [s.employee_code, s]));

// --- Routes & stops ----------------------------------------------------------
console.log("Laying out routes and stops…");
const routes = await ins("route", ROUTES.map((r) => ({ code: r.code, name: r.name })), true);
const routeByCode = Object.fromEntries(routes.map((r) => [r.code, r]));

// City running, stop to stop: roughly 18 km/h, plus a minute of boarding.
const legMinutes = (m) => Math.max(3, Math.round(m / 300) + 1);

const stopRows = [];
for (const r of ROUTES) {
  const list = [...r.stops, SCHOOL];          // morning order: pickups, then school
  const legs = list.map((s, i) => (i === 0 ? 0 : metres(list[i - 1], s)));

  // Morning: first pickup at firstPickup, accumulating forwards to the gate.
  const am = [];
  let t = r.firstPickup;
  legs.forEach((leg, i) => { if (i > 0) t += legMinutes(leg); am.push(t); });

  // Afternoon: the same road driven backwards, leaving the gate at 14:30.
  const pm = new Array(list.length);
  t = 14 * 60 + 30;
  pm[list.length - 1] = t;
  for (let i = list.length - 2; i >= 0; i--) { t += legMinutes(legs[i + 1]); pm[i] = t; }

  let cum = 0;
  list.forEach((s, i) => {
    cum += legs[i];
    stopRows.push({
      route_id: routeByCode[r.code].id, seq: i + 1, name: s.name, landmark: s.landmark ?? null,
      lat: s.lat, lng: s.lng,
      geofence_m: s.name === SCHOOL.name ? 150 : 120,
      sched_am: hhmm(am[i]),
      sched_pm: hhmm(pm[i]),
      cum_distance_m: cum,
    });
  });
}
const stops = await ins("route_stop", stopRows, true);
const stopsByRoute = {};
for (const s of stops) (stopsByRoute[s.route_id] ||= []).push(s);
for (const k in stopsByRoute) stopsByRoute[k].sort((a, b) => a.seq - b.seq);

// --- Assignments -------------------------------------------------------------
console.log("Assigning buses to routes…");
const assignments = await ins("bus_assignment", ROUTES.map((r) => {
  const c = CREW.filter((x) => x.bus === r.bus);
  return {
    bus_id: busByCode[r.bus].id, route_id: routeByCode[r.code].id, academic_year_id: year.id,
    driver_staff_id: crewByCode[c.find((x) => x.kind === "driver").code].id,
    conductor_staff_id: crewByCode[c.find((x) => x.kind === "conductor").code].id,
    is_active: true,
  };
}), true);

// --- Who rides which bus -----------------------------------------------------
// About a third of the school takes the bus. The demo parent's children and the
// demo student are always included, so those logins actually show a bus.
console.log("Allotting pupils to stops…");
const demoStudentIds = new Set();
const [demoStudentProfile] = await sel("profile?select=student_id&student_id=not.is.null&order=id&limit=1");
const guardianRows = await sel("guardian?select=id&email=eq.parent@kv.demo");
if (guardianRows.length) {
  const links = await sel(`guardian_student?select=student_id&guardian_id=eq.${guardianRows[0].id}`);
  links.forEach((l) => demoStudentIds.add(l.student_id));
}
const profiles = await sel("profile?select=student_id&role=eq.student");
profiles.forEach((p) => p.student_id && demoStudentIds.add(p.student_id));
if (demoStudentProfile?.student_id) demoStudentIds.add(demoStudentProfile.student_id);

const routeCodes = ROUTES.map((r) => r.code);
const alloc = [];
const seen = new Set();
// Round-robin the stops with a PER-ROUTE counter. Deriving the stop from the
// same index that picks the route makes the two cycles alias, and every pupil
// on a route ends up at one stop.
const nextStopIdx = {};
enrolled.forEach((e, i) => {
  const isDemo = demoStudentIds.has(e.student_id);
  if (!isDemo && i % 3 !== 0) return;                  // ~1 in 3 rides the bus
  if (seen.has(e.student_id)) return;
  seen.add(e.student_id);
  // Demo pupils go on R3/BUS-03, the bus the demo conductor drives.
  const rc = isDemo ? "R3" : routeCodes[i % routeCodes.length];
  const rid = routeByCode[rc].id;
  const list = stopsByRoute[rid];
  const k = (nextStopIdx[rid] = (nextStopIdx[rid] ?? 0) + 1);
  const boarding = list[k % (list.length - 1)];        // never the school gate
  alloc.push({
    student_id: e.student_id, academic_year_id: year.id, route_id: rid,
    pickup_stop_id: boarding.id, drop_stop_id: boarding.id, is_active: true,
  });
});
await ins("student_transport", alloc);

// --- Conductor demo login ----------------------------------------------------
console.log("Wiring the conductor demo login…");
const AUTH = `${URL_BASE}/auth/v1`;
async function createUser(email, password, fullName) {
  const r = await fetch(`${AUTH}/admin/users`, { method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }) });
  if (r.ok) return (await r.json()).id;
  const list = await fetch(`${AUTH}/admin/users?per_page=300`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const u = (await list.json()).users.find((x) => x.email === email);
  if (!u) throw new Error(`could not create or find ${email}: ${(await r.text()).slice(0, 200)}`);
  await fetch(`${AUTH}/admin/users/${u.id}`, { method: "PUT",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }) });
  return u.id;
}
const conductorStaff = crewByCode[CONDUCTOR_DEMO.staff];
const uid = await createUser(CONDUCTOR_DEMO.email, CONDUCTOR_DEMO.password, conductorStaff.full_name);
const up = await fetch(`${BASE}/profile`, { method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify([{ id: uid, role: "staff", full_name: conductorStaff.full_name, staff_id: conductorStaff.id }]) });
if (!up.ok) throw new Error(`profile upsert → ${up.status} ${(await up.text()).slice(0, 300)}`);

// --- Summary -----------------------------------------------------------------
const perRoute = ROUTES.map((r) => {
  const rid = routeByCode[r.code].id;
  return `${r.code}:${alloc.filter((a) => a.route_id === rid).length}`;
}).join("  ");
console.log(`
DONE — transport seeded.
  ${buses.length} buses · ${routes.length} routes · ${stops.length} stops · ${assignments.length} assignments
  ${alloc.length} pupils allotted   (${perRoute})
  conductor login: ${CONDUCTOR_DEMO.email} / ${CONDUCTOR_DEMO.password}  → ${conductorStaff.full_name}, BUS-03 (R3)`);
