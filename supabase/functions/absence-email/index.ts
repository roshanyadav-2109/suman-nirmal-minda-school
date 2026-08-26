// Edge Function: absence-email
// Emails guardians of students marked absent on a given date.
// Invoke: POST { "date": "2026-02-07", "sectionId"?: number }
// Can be wired to a Database Webhook on attendance_record inserts, or run daily.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sendEmail } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { date, sectionId } = await req.json().catch(() => ({}));
  if (!date) return json({ error: "date required" }, 400);

  // Service-role client (server-side only) — bypasses RLS for the notification job.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let q = admin
    .from("attendance_record")
    .select("student_id, status, student:student_id(full_name, guardian_student(guardian:guardian_id(full_name, email)))")
    .eq("on_date", date)
    .is("period", null)
    .eq("status", "absent");
  if (sectionId) q = q.eq("section_id", sectionId);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let sent = 0, skipped = 0;
  for (const rec of data ?? []) {
    const student = rec.student as { full_name: string; guardian_student: { guardian: { full_name: string; email: string | null } }[] };
    for (const gs of student?.guardian_student ?? []) {
      const email = gs.guardian?.email;
      if (!email) { skipped++; continue; }
      const html = `<p>Dear ${gs.guardian.full_name},</p>
        <p>This is to inform you that <strong>${student.full_name}</strong> was marked
        <strong>absent</strong> on ${date} at Kendriya Vidyalaya IIT Kharagpur.</p>
        <p>If this is unexpected, please contact the class teacher.</p>`;
      const r = await sendEmail(email, `Absence notice — ${student.full_name} (${date})`, html);
      if (r.ok) sent++; else skipped++;
    }
  }
  return json({ ok: true, date, absentees: data?.length ?? 0, sent, skipped });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
