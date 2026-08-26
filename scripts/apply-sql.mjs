// Apply a .sql file to the Supabase project via the Management API query endpoint.
// Usage: node scripts/apply-sql.mjs <path-to-sql>
import { readFileSync } from "node:fs";

const REF = process.env.SUPABASE_REF || "qyiqdwrjtgdzocoffzvk";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("Set SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/apply-sql.mjs <file.sql>"); process.exit(1); }

const query = readFileSync(file, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`FAILED (${res.status}) applying ${file}:`);
  console.error(text);
  process.exit(1);
}
console.log(`OK: ${file}`);
try { const j = JSON.parse(text); if (Array.isArray(j) && j.length) console.log(JSON.stringify(j).slice(0, 500)); } catch {}
