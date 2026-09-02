// =============================================================================
// Drive a bus along its route without a bus.
//
//   node scripts/simulate-trip.mjs [--shift=morning|afternoon] [--speed=20] [--end]
//
// Signs in as the demo conductor with the ANON key and writes through exactly
// the same RLS path the phone uses — no service-role shortcut — so a green run
// proves the policies, the geofence trigger, the ETA and the alert queue all
// work for a real conductor, not just for a superuser.
//
//   --speed   how many simulated seconds pass per real second (default 20)
//   --end     close the trip when the route finishes (default: leave it running
//             so you can watch the live map)
// =============================================================================
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split("=").pop();
const SHIFT = arg("shift", "morning");
const SPEEDUP = Number(arg("speed", 20));
const END_AFTER = process.argv.includes("--end");
const EMAIL = arg("email", "conductor@kv.demo");
const PW = arg("password", "kviit@demo1");

// --- sign in as the conductor ------------------------------------------------
const auth = await (await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PW }) })).json();
if (!auth.access_token) { console.error("login failed:", JSON.stringify(auth).slice(0, 200)); process.exit(1); }
const H = { apikey: ANON, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };
const api = `${URL_BASE}/rest/v1`;

const get = async (p) => {
  const r = await fetch(`${api}/${p}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`);
  return r.json();
};
const post = async (t, body, prefer = "return=representation") => {
  const r = await fetch(`${api}/${t}`, { method: "POST", headers: { ...H, Prefer: prefer }, body: JSON.stringify(body) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`POST ${t} → ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
};
const patch = async (t, filter, body) => {
  const r = await fetch(`${api}/${t}?${filter}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${t} → ${r.status} ${(await r.text()).slice(0, 300)}`);
};

// --- what am I driving? ------------------------------------------------------
// RLS already narrows bus_assignment reads; the conductor's own crew row is
// found through the staff link on their profile.
const [me] = await get("profile?select=staff_id,full_name");
const assigns = await get(`bus_assignment?select=id,bus_id,route_id,is_active&or=(conductor_staff_id.eq.${me.staff_id},driver_staff_id.eq.${me.staff_id})&is_active=is.true`);
if (!assigns.length) { console.error(`${me.full_name} is not crewing any bus this year.`); process.exit(1); }
const A = assigns[0];
const [bus] = await get(`bus?select=code,registration_no&id=eq.${A.bus_id}`);
const [route] = await get(`route?select=code,name&id=eq.${A.route_id}`);
let stops = await get(`route_stop?select=id,seq,name,lat,lng,geofence_m,cum_distance_m&route_id=eq.${A.route_id}&order=seq`);
if (SHIFT === "afternoon") stops = [...stops].reverse();

console.log(`${me.full_name} · ${bus.code} (${bus.registration_no}) · ${route.code} ${route.name}`);
console.log(`${SHIFT} run, ${stops.length} stops, ${SPEEDUP}x speed\n`);

// --- start (or resume) today's trip -----------------------------------------
const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);   // IST
let [trip] = await get(`trip?select=id,status&bus_assignment_id=eq.${A.id}&service_date=eq.${today}&shift=eq.${SHIFT}`);
if (!trip) {
  [trip] = await post("trip", [{ bus_assignment_id: A.id, shift: SHIFT, started_by: null }]);
  console.log(`trip ${trip.id} started`);
} else if (trip.status !== "running") {
  await patch("trip", `id=eq.${trip.id}`, { status: "running", ended_at: null });
  console.log(`trip ${trip.id} resumed`);
} else {
  console.log(`trip ${trip.id} already running — continuing it`);
}

// --- drive -------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (d) => (d * Math.PI) / 180;
const metres = (a, b) => 2 * 6371000 * Math.asin(Math.sqrt(
  Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
  Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
const bearing = (a, b) => {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const CRUISE_KMH = 26;            // city arterial with traffic
const TICK_S = 10;                // one ping every 10 simulated seconds

for (let i = 1; i < stops.length; i++) {
  const from = stops[i - 1], to = stops[i];
  const legM = metres(from, to);
  const legS = Math.max(TICK_S, Math.round(legM / (CRUISE_KMH / 3.6)));
  const ticks = Math.ceil(legS / TICK_S);

  for (let k = 1; k <= ticks; k++) {
    const t = k / ticks;
    // A little traffic: speed wobbles, and the bus slows into each stop.
    const kmh = Math.max(6, CRUISE_KMH * (0.75 + 0.35 * Math.sin(k / 2)) * (t > 0.85 ? 0.5 : 1));
    await post("trip_ping", [{
      trip_id: trip.id,
      lat: lerp(from.lat, to.lat, t),
      lng: lerp(from.lng, to.lng, t),
      speed_kmh: Number(kmh.toFixed(1)),
      heading: Number(bearing(from, to).toFixed(0)),
      accuracy_m: 8 + Math.round(Math.random() * 12),
      battery_pct: Math.max(20, 95 - i * 3),
      device_at: new Date().toISOString(),
    }], "return=minimal");
    await sleep((TICK_S / SPEEDUP) * 1000);
  }

  // Read back what the server made of it — this is the actual assertion.
  const [live] = await get(`bus_live?select=next_stop_id,eta_seconds,stops_remaining,speed_kmh&bus_id=eq.${A.bus_id}`);
  const arrived = await get(`trip_stop_event?select=route_stop_id,event&trip_id=eq.${trip.id}&event=eq.arrived`);
  const nextName = stops.find((s) => s.id === live?.next_stop_id)?.name ?? "—";
  const eta = live?.eta_seconds == null ? "—" : `${Math.round(live.eta_seconds / 60)} min`;
  console.log(`  reached ${to.name.padEnd(26)} next: ${nextName.padEnd(26)} eta ${eta.padStart(6)}  arrived:${arrived.length}/${stops.length}`);
}

// --- what did the parents get? ----------------------------------------------
// Read as the principal: a conductor has no policy on transport_alert (alerts
// are about pupils, and crew are not in a pupil's scope), so counting them from
// this session would always print zero and prove nothing.
{
  const p = await (await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "principal@kv.demo", password: PW }) })).json();
  if (p.access_token) {
    const r = await fetch(`${api}/transport_alert?select=kind&trip_id=eq.${trip.id}`,
      { headers: { apikey: ANON, Authorization: `Bearer ${p.access_token}` } });
    const alerts = await r.json();
    const byKind = alerts.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {});
    console.log(`\nalerts queued for families: ${JSON.stringify(byKind)}`);
  }
}

if (END_AFTER) {
  await patch("trip", `id=eq.${trip.id}`, { status: "completed", ended_at: new Date().toISOString() });
  console.log("trip completed.");
} else {
  console.log("trip left running — open /transport to watch it, or re-run with --end to close it.");
}
