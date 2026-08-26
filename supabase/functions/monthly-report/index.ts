// Edge Function: monthly-report
// Generates monthly reports for a whole class (or one student) in one step:
// computes marks + attendance for the month, stores an HTML report in the
// `reports` Storage bucket, upserts monthly_report, and emails guardians.
// Invoke: POST { "month": "2026-02", "sectionId": 22, "yearId": 4 }
//         POST { "month": "2026-02", "studentId": 123, "yearId": 4 }
// (HTML is stored; convert to PDF with a headless renderer for print-fidelity.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sendEmail } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { month, sectionId, studentId, yearId } = await req.json().catch(() => ({}));
  if (!month || !yearId) return json({ error: "month and yearId required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  // Which students?
  let studentIds: number[] = [];
  if (studentId) studentIds = [studentId];
  else if (sectionId) {
    const { data } = await admin.from("student_enrollment").select("student_id").eq("section_id", sectionId).eq("academic_year_id", yearId);
    studentIds = (data ?? []).map((e) => e.student_id);
  }
  if (!studentIds.length) return json({ error: "no students" }, 400);

  let generated = 0;
  for (const sid of studentIds) {
    const [{ data: student }, { data: marks }, { data: att }] = await Promise.all([
      admin.from("student").select("full_name, admission_no, guardian_student(guardian:guardian_id(full_name, email))").eq("id", sid).single(),
      admin.from("v_mark_detail").select("subject_name, assessment_name, percent, band").eq("student_id", sid).eq("academic_year_id", yearId).gte("assessed_on", start).lte("assessed_on", end),
      admin.from("attendance_record").select("status").eq("student_id", sid).is("period", null).gte("on_date", start).lte("on_date", end),
    ]);
    if (!student) continue;

    const total = (att ?? []).length;
    const present = (att ?? []).filter((a) => a.status === "present" || a.status === "late").length;
    const attPct = total ? Math.round((present / total) * 1000) / 10 : null;

    const html = renderHtml(student.full_name, student.admission_no, month, attPct, present, total, marks ?? []);
    const path = `${sid}/${month}.html`;
    await admin.storage.from("reports").upload(path, new Blob([html], { type: "text/html" }), { upsert: true, contentType: "text/html" });

    await admin.from("monthly_report").upsert({
      student_id: sid, section_id: sectionId ?? null, academic_year_id: yearId, month: start,
      summary: { attPct, present, total, marks }, pdf_path: path, generated_at: new Date().toISOString(),
    }, { onConflict: "student_id,month" });

    const guardians = (student as { guardian_student?: { guardian: { full_name: string; email: string | null } }[] }).guardian_student ?? [];
    for (const g of guardians) if (g.guardian?.email) await sendEmail(g.guardian.email, `Monthly report — ${student.full_name} (${month})`, html);
    generated++;
  }
  return json({ ok: true, month, generated });
});

function renderHtml(name: string, adm: string, month: string, attPct: number | null, present: number, total: number, marks: { subject_name: string; assessment_name: string; percent: number; band: string | null }[]) {
  const rows = marks.map((m) => `<tr><td>${m.subject_name}</td><td>${m.assessment_name}</td><td style="text-align:right">${m.percent}</td><td style="text-align:center">${m.band ?? "-"}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Inter,system-ui,sans-serif;color:#2B1B1C;max-width:640px;margin:24px auto;padding:0 16px}
    h1{font-size:20px} .muted{color:#857971;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:8px} td,th{border-bottom:1px solid #E9E0D4;padding:6px;font-size:14px;text-align:left}
    .box{background:#FBF3E2;border:1px solid #E09E3E;border-radius:12px;padding:12px;margin:12px 0}
  </style></head><body>
    <h1>Kendriya Vidyalaya IIT Kharagpur</h1>
    <div class="muted">Monthly Report · ${month}</div>
    <p><strong>${name}</strong> <span class="muted">${adm}</span></p>
    <div class="box">Attendance this month: <strong>${attPct ?? "—"}%</strong> (${present}/${total} present)</div>
    <table><thead><tr><th>Subject</th><th>Assessment</th><th style="text-align:right">%</th><th style="text-align:center">Band</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="muted">No marks this month</td></tr>'}</tbody></table>
  </body></html>`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
