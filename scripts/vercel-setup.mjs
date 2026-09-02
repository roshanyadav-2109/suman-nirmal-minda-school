// Set env vars on a Vercel project and trigger a production redeploy.
//   node scripts/vercel-setup.mjs
// Requires: VERCEL_TOKEN
//
// Optional — pick which Vercel project to target (default: suman-nirmal-minda-school):
//   VERCEL_PROJECT=<project-or-repo-name>
// Optional — school branding for a second school's deployment. Any of these
// that are set in the shell are pushed to the project alongside the Supabase
// keys, so the same repo builds as a different school:
//   NEXT_PUBLIC_SCHOOL_NAME / _PLACE / _SHORT_NAME / _MONOGRAM / _LOGO / _LOGIN_IMAGE
import "node:process";
import { readFileSync } from "node:fs";

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) { console.error("Set VERCEL_TOKEN"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// The Supabase project comes from .env.local — the same backend this checkout
// actually runs against. Hardcoding it here once meant production could be
// pointed at a DIFFERENT school's database than the one being developed and
// tested, which is exactly what happened before this school got its own project.
// Both values are browser-safe by design (RLS is the boundary).
const local = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/?
/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || local.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
if (!ENV.NEXT_PUBLIC_SUPABASE_URL || !ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("No Supabase URL/anon key — set them in .env.local or the environment");
  process.exit(1);
}
console.log("backend:", ENV.NEXT_PUBLIC_SUPABASE_URL);

// Branding vars are optional — only forwarded when present in the environment.
for (const k of ["NEXT_PUBLIC_SCHOOL_NAME", "NEXT_PUBLIC_SCHOOL_PLACE", "NEXT_PUBLIC_SCHOOL_SHORT_NAME",
                 "NEXT_PUBLIC_SCHOOL_MONOGRAM", "NEXT_PUBLIC_SCHOOL_LOGO", "NEXT_PUBLIC_SCHOOL_LOGIN_IMAGE"]) {
  if (process.env[k]) ENV[k] = process.env[k];
}

const TARGET = (process.env.VERCEL_PROJECT || "suman-nirmal-minda-school").toLowerCase();

async function api(path, opts = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}

// 1. Identify account + teams
const me = await api("/v2/user");
console.log("user:", me.json?.user?.username ?? me.json?.user?.email ?? "?");
const teams = (await api("/v2/teams")).json?.teams ?? [];
const scopes = [{ teamId: null, label: "personal" }, ...teams.map((t) => ({ teamId: t.id, label: t.slug }))];

// 2. Find the project (match repo suman-nirmal-minda-school or name)
let project = null, scope = null;
for (const s of scopes) {
  const q = s.teamId ? `?teamId=${s.teamId}&limit=100` : "?limit=100";
  const list = (await api(`/v9/projects${q}`)).json?.projects ?? [];
  const found = list.find((p) =>
    p.name?.toLowerCase() === TARGET ||
    p.name?.toLowerCase().includes(TARGET) ||
    p.link?.repo?.toLowerCase() === TARGET);
  if (found) { project = found; scope = s; break; }
  // fall back: remember first project in case there's exactly one
  if (!project && list.length) { /* keep scanning */ }
}
if (!project) {
  // list everything to help the user pick
  console.error("Could not auto-find the project. Projects visible to this token:");
  for (const s of scopes) {
    const q = s.teamId ? `?teamId=${s.teamId}&limit=100` : "?limit=100";
    const list = (await api(`/v9/projects${q}`)).json?.projects ?? [];
    list.forEach((p) => console.error(`  [${s.label}] ${p.name}  (repo: ${p.link?.org}/${p.link?.repo ?? "—"})`));
  }
  process.exit(1);
}
const tq = scope.teamId ? `?teamId=${scope.teamId}` : "";
console.log(`project: ${project.name}  scope: ${scope.label}  repo: ${project.link?.org}/${project.link?.repo}`);

// 3. Upsert env vars (production + preview + development)
for (const [key, value] of Object.entries(ENV)) {
  const r = await api(`/v10/projects/${project.id}/env${tq ? tq + "&upsert=true" : "?upsert=true"}`, {
    method: "POST",
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview", "development"] }),
  });
  console.log(`env ${key}: ${r.ok ? "set" : "FAILED " + JSON.stringify(r.json).slice(0, 200)}`);
}

// 4. Trigger a production redeploy from the connected git repo
if (!project.link?.repoId) { console.log("No git link found; redeploy manually in the Vercel dashboard."); process.exit(0); }
const dep = await api(`/v13/deployments${tq}`, {
  method: "POST",
  body: JSON.stringify({
    name: project.name,
    project: project.id,
    target: "production",
    gitSource: { type: project.link.type || "github", repoId: project.link.repoId, ref: "main" },
  }),
});
if (dep.ok) console.log(`redeploy triggered: https://${dep.json.url}  (state: ${dep.json.readyState || dep.json.status})`);
else console.log("redeploy FAILED:", JSON.stringify(dep.json).slice(0, 300), "\n→ add vars are set; just click Redeploy in the dashboard.");
