// Edge Function: transport-alert
// Drains the transport_alert outbox — the bus alerts queued by the geofence and
// ETA triggers in migration 0025 — and emails the guardians of each pupil.
// Invoke: POST {} (no body needed). Wired to pg_cron every minute in 0028.
//
// The outbox pattern is deliberate: the database decides WHAT to say the moment
// it happens, inside the transaction that observed it, and delivery is a
// separate, retryable step. A failed send leaves sent_at null and is picked up
// on the next run rather than being lost.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sendEmail } from "../_shared/cors.ts";

const SCHOOL = Deno.env.get("SCHOOL_NAME") ?? "The Suman Nirmal Minda School";
const BATCH = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role client: this is a server-side job, and the outbox has no
  // client-writable policy by design.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // With no mail transport configured there is nothing this run can do EXCEPT
  // damage: draining the outbox would stamp every queued alert "skipped" and
  // throw away messages that would have been deliverable the moment a key is
  // set. Report and leave the queue untouched.
  if (!Deno.env.get("RESEND_API_KEY")) {
    const { count } = await admin
      .from("transport_alert")
      .select("id", { count: "exact", head: true })
      .is("sent_at", null);
    return json({ ok: true, held: count ?? 0, reason: "RESEND_API_KEY not set — queue left intact" });
  }

  const { data: pending, error } = await admin
    .from("transport_alert")
    .select(`id, kind, payload, created_at,
             student:student_id(full_name, guardian_student(guardian:guardian_id(full_name, email))),
             stop:route_stop_id(name, sched_am, sched_pm),
             trip:trip_id(shift, bus_assignment:bus_assignment_id(bus:bus_id(code)))`)
    .is("sent_at", null)
    .order("created_at")
    .limit(BATCH);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ ok: true, pending: 0, sent: 0 });

  let sent = 0, skipped = 0;
  const done: { id: number; channel: string }[] = [];

  for (const a of pending) {
    const student = a.student as { full_name: string; guardian_student: { guardian: { full_name: string; email: string | null } }[] } | null;
    const stop = a.stop as { name: string } | null;
    const trip = a.trip as { shift: string; bus_assignment: { bus: { code: string } | null } | null } | null;
    const bus = trip?.bus_assignment?.bus?.code ?? "the school bus";
    if (!student) { done.push({ id: a.id, channel: "skipped" }); continue; }

    const line = message(a.kind as Kind, {
      child: student.full_name,
      stop: stop?.name ?? "the stop",
      bus,
      minutes: Number((a.payload as Record<string, unknown>)?.delay_minutes ?? 0),
      eta: Math.round(Number((a.payload as Record<string, unknown>)?.eta_seconds ?? 0) / 60),
      shift: trip?.shift === "afternoon" ? "afternoon" : "morning",
    });

    let delivered = false;
    for (const gs of student.guardian_student ?? []) {
      const email = gs.guardian?.email;
      if (!email) { skipped++; continue; }
      const html = `<p>Dear ${gs.guardian.full_name},</p><p>${line}</p>
        <p style="color:#666;font-size:13px">${SCHOOL} — school transport. Times are estimates from the bus's current position.</p>`;
      const r = await sendEmail(email, `${bus} — ${student.full_name}`, html);
      if (r.ok) { sent++; delivered = true; } else skipped++;
    }
    // Handled either way: an alert with no reachable guardian is not a reason to
    // retry forever, and "the bus is five minutes away" is worthless an hour
    // later. But the record must say what actually happened — marking an alert
    // "email" when no mail could be sent (no RESEND_API_KEY, no address) would
    // make the outbox lie about its own history.
    done.push({ id: a.id, channel: delivered ? "email" : "skipped" });
  }

  const stamp = new Date().toISOString();
  for (const channel of ["email", "skipped"]) {
    const ids = done.filter((d) => d.channel === channel).map((d) => d.id);
    if (ids.length) {
      await admin.from("transport_alert").update({ sent_at: stamp, channel }).in("id", ids);
    }
  }
  return json({ ok: true, pending: pending.length, sent, skipped });
});

type Kind = "trip_started" | "approaching" | "arrived" | "delayed" | "trip_ended";

function message(kind: Kind, v: { child: string; stop: string; bus: string; minutes: number; eta: number; shift: string }) {
  switch (kind) {
    case "approaching":
      return `${v.bus} is about ${Math.max(1, v.eta)} minute(s) from ${v.stop}. Please have ${v.child} ready.`;
    case "arrived":
      return v.shift === "morning"
        ? `${v.bus} has reached ${v.stop}.`
        : `${v.bus} has reached ${v.stop} for the afternoon drop.`;
    case "delayed":
      return `${v.bus} is running about ${v.minutes} minute(s) behind schedule for ${v.stop}.`;
    case "trip_started":
      return `${v.bus} has started its ${v.shift} run.`;
    case "trip_ended":
      return `${v.bus} has finished its ${v.shift} run.`;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
