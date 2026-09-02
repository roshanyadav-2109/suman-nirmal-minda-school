# The Suman Nirmal Minda School, Ahmedabad — Student Progress & School Portal

A school-owned, mobile-responsive web portal (classes I–XII). Its spine is a
**continuous, year-on-year student progress record** with real analytics, wrapped in
attendance, announcements/events, monthly reports, leave and parent feedback.

Access is driven by **allotment**, enforced at the database with **Supabase Row Level
Security** — the UI hiding data is never the security boundary.

## ⚠ Backend status — read before a handover

This deployment points at the **same Supabase project as the KV IIT Kharagpur portal**
(`NEXT_PUBLIC_SUPABASE_URL` in `.env.local`). The schema is **single-tenant**: a
`school` table exists, but no table, RLS policy or RPC filters on `school_id`.

**So this site shows the KV IIT Kharagpur data, under Suman Nirmal Minda branding.**
That is fine for a product demo. Before this school uses it for real, one of:

1. **Own Supabase project** (recommended) — apply `supabase/migrations/0001…0021` to a
   fresh project, seed this school's own students/staff/allotments, then point
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` at it. Nothing else changes.
2. **Make the shared project multi-tenant** — add `school_id` across the 25 tables,
   backfill KV, and extend every RLS policy and analytics RPC to filter by it.

Until then, treat the demo logins as showing another school's records.

## Branding

Everything school-specific lives in **`src/lib/school.ts`** — name, sub-line, emblem,
sign-in photo, browser title, monogram — each overridable with a `NEXT_PUBLIC_SCHOOL_*`
env var (see `.env.example`). No school name is hardcoded in any component.

Drop the official emblem at `public/brand/school-logo.png` (see `public/brand/README.md`);
until it exists the app renders a typographic `SM` monogram rather than an invented logo.
With no sign-in photograph configured, the sign-in page shows a plain branded panel.

---

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4** — design tokens in `globals.css` `@theme`.
- **Supabase**: Postgres + Auth + RLS + Storage + Edge Functions (Deno) + `pg_cron`.
- **Recharts** (styled strictly to the design tokens) · **Hugeicons** (single icon set, centralised in `src/components/icons.tsx`).
- **i18n**: English / Hindi / Bengali via translation keys (`src/i18n`), localised numbers & dates.

## Demo logins

On the login screen, one tap signs you in as each role. Password (all): `kviit@demo1`.

| Role | Email | Scope |
|---|---|---|
| Principal | `principal@kv.demo` | Whole school |
| Class Teacher | `classteacher@kv.demo` | VIII-A (all subjects, full history) |
| Subject Teacher | `teacher@kv.demo` | Mathematics across allotted sections |
| Parent / Guardian | `parent@kv.demo` | Two children (sibling switcher) |
| Student | `student@kv.demo` | Own record only |
| Office / Admin | `office@kv.demo` | Manage; unrestricted read |

Each lands in a **DB-scoped** view — RLS returns zero rows outside scope regardless of what the client asks for.

## Run locally

```bash
npm install
# .env.local already contains the public Supabase URL + anon key
npm run dev        # http://localhost:3000
```

## Database

All schema lives in `supabase/migrations/` and is already applied to the linked project.
To re-apply / point at another project, run them in order with the helper:

```bash
export SUPABASE_ACCESS_TOKEN=...       # Supabase personal access token
export SUPABASE_REF=...                # project ref
node scripts/apply-sql.mjs supabase/migrations/0001_core_schema.sql
# … 0002 … through 0008
```

| Migration | Purpose |
|---|---|
| `0001_core_schema` | 25 tables, enums, constraints, indexes |
| `0002_security` | `app` scope helpers + RLS policies on every table |
| `0003_analytics` | RLS-aware views + RPC (trends, distributions, top/needs-support, auto-conclusions) |
| `0004_rls_performance` | Set-based helpers so large tables stay fast under RLS |
| `0005_history_scope` | Class teacher sees each student's full prior-year history |
| `0006_slippage_job` | `refresh_slippage_flags()` — scheduled early-slippage computation |
| `0007_cron` | Nightly `pg_cron` schedule for the slippage job |
| `0008_storage` | `brand` (public) + `reports` (private) Storage buckets |

### Seed & verify

```bash
export SUPABASE_SERVICE_ROLE=...       # server-only key
node scripts/seed.mjs         # ~270 students, 2 years of marks, attendance, comms
node scripts/seed-auth.mjs    # demo auth users + profile links
node scripts/verify-rls.mjs   # proves each role only sees its scope
```

`verify-rls.mjs` output (proof the boundary holds):

```
role          students  marks  attendance  slippage
principal          270  22680      8100         5
classteacher        30   2520       900         2
teacher            150   1440      4500         3
parent               2    168        60         0   ← never sees slippage
student              1     84        30         0   ← own record only
```

## The access model (RLS)

`teacher_allotment` (staff × section × subject, with `is_class_teacher`) drives everything.
Private `app.*` helpers (SECURITY DEFINER) resolve the caller's scope once per query:

- **Subject teacher** → their subject × allotted sections.
- **Class teacher** → their whole section, all subjects, **full multi-year history**.
- **Principal / office** → everything.
- **Guardian / student** → own record(s) only; **never** the needs-support / slippage lists.

## Analytics (the centrepiece)

- Per-student **continuous record**: assessment timeline, subject trend lines, every result shown
  as a delta vs the student's own past ("62, up from 55 last time").
- **Section/class analytics** scoped by allotment: subject-vs-subject, section-vs-section,
  distribution, best performers, students-needing-support (intervention-framed, staff-only),
  and **auto-generated "Areas of improvement"** computed from real metrics.
- **Early-slippage flags** recomputed nightly (`pg_cron`).

## Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `absence-email` | Emails guardians of students marked absent (Resend) |
| `monthly-report` | Generates a class's monthly reports in one step → Storage + email |
| `transport-alert` | Drains the bus-alert outbox and emails guardians (see below) |

Deploy (needs the Supabase CLI + `RESEND_API_KEY` secret):

```bash
supabase link --project-ref $SUPABASE_REF
supabase functions deploy absence-email
supabase functions deploy monthly-report
supabase secrets set RESEND_API_KEY=...
```

### Bus alerts (`transport-alert`)

Deploying needs no CLI — the Management API takes the bundle directly:

```bash
export SUPABASE_ACCESS_TOKEN=...   # personal access token
export SUPABASE_REF=...            # project ref
node scripts/deploy-function.mjs transport-alert
```

The database queues alerts into `transport_alert` the instant a geofence or ETA
trigger observes something worth telling a family; `pg_cron` calls the function
every minute to drain the queue. The dispatcher reads its own URL and key from
**Vault**, not from a database parameter (a managed project will not let you set
one):

```sql
select vault.create_secret('https://<ref>.functions.supabase.co', 'transport_functions_url');
select vault.create_secret('<service-role key>', 'transport_service_key');
```

Mail itself is the last step. Until `RESEND_API_KEY` is set on the function, it
**holds the queue rather than draining it** — so nothing is silently marked sent
and nothing is thrown away before it could be delivered:

```bash
supabase secrets set RESEND_API_KEY=...   # or set it in the dashboard
```


## Design system

Warm, institutional: **gold = aspiration**, **warm ink = trust**; the tricolour
green/saffron appear **only** as data-status colours. Inter everywhere, hairline borders, soft
warm shadows, consistent rounding. The official emblem drops into
`public/brand/school-logo.png` (a typographic monogram ships until then — no invented logo).

## Security notes

- The service-role key is **server-only** (`.env.local` `SUPABASE_SERVICE_ROLE_KEY`, Edge Functions). Never shipped to the client.
- The tokens used to build this demo should be **rotated** before any real use.
