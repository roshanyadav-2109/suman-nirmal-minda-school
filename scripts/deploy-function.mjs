// Deploy an Edge Function through the Management API — no Supabase CLI, no
// Docker, nothing to install.
//
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_REF=... node scripts/deploy-function.mjs transport-alert
// The function imports ../_shared/cors.ts, so the bundle keeps the same folder
// shape the repo has: <slug>/index.ts beside _shared/cors.ts.
import { readFileSync } from 'node:fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_REF;
const SLUG = process.argv[2] || 'transport-alert';

const files = [
  { path: `${SLUG}/index.ts`, local: `supabase/functions/${SLUG}/index.ts` },
  { path: '_shared/cors.ts', local: 'supabase/functions/_shared/cors.ts' },
];

const form = new FormData();
form.append('metadata', JSON.stringify({
  name: SLUG,
  entrypoint_path: `${SLUG}/index.ts`,
  verify_jwt: true,
}));
for (const f of files) {
  form.append('file', new Blob([readFileSync(f.local)], { type: 'application/typescript' }), f.path);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${SLUG}`,
  { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: form },
);
const text = await res.text();
console.log(res.status, text.slice(0, 600));
