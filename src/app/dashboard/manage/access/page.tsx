import { createClient } from "@/lib/supabase/server";
import { getStaffScope } from "@/lib/data/scope";
import { AccessAdmin, type AccessRow, type StaffOption, type SectionOption } from "@/components/manage/access/access-admin";

const STAFF_LABEL: Record<string, string> = {
  principal: "Principal",
  office: "Office",
  subject_teacher: "Teacher",
  class_teacher: "Class teacher",
  transport: "Transport staff",
};

// Manage School → Give access (office only; the layout checks). Everyone whose
// school record has an email — they sign in with Google using it — and a form
// to give someone a dashboard.
export default async function ManageAccessPage() {
  const supabase = await createClient();
  const [staffRes, guardianRes, studentRes, loginRes, scope] = await Promise.all([
    supabase.from("staff").select("id, full_name, role, email").order("full_name"),
    supabase.from("guardian").select("id, full_name, relation, email, guardian_student(student:student_id(full_name))").not("email", "is", null).order("full_name"),
    supabase.from("student").select("id, full_name, admission_no, email").not("email", "is", null).order("full_name"),
    supabase.from("profile").select("staff_id, guardian_id, student_id"),
    getStaffScope(),
  ]);

  const logins = loginRes.data ?? [];
  const has = (k: "staff_id" | "guardian_id" | "student_id", id: number) => logins.some((p) => p[k] === id);

  const rows: AccessRow[] = [
    ...(staffRes.data ?? []).filter((s) => s.email).map((s) => ({
      kind: "staff" as const, id: s.id, name: s.full_name, email: s.email!,
      dashboard: STAFF_LABEL[s.role] ?? s.role, signedIn: has("staff_id", s.id),
    })),
    ...((guardianRes.data ?? []) as unknown as { id: number; full_name: string; relation: string | null; email: string; guardian_student: { student: { full_name: string } | null }[] }[]).map((g) => ({
      kind: "guardian" as const, id: g.id, name: g.full_name, email: g.email,
      dashboard: `Parent${g.guardian_student.length ? ` of ${g.guardian_student.map((l) => l.student?.full_name).filter(Boolean).join(", ")}` : ""}`,
      signedIn: has("guardian_id", g.id),
    })),
    ...(studentRes.data ?? []).map((s) => ({
      kind: "student" as const, id: s.id, name: s.full_name, email: s.email!,
      dashboard: `Student · ${s.admission_no}`, signedIn: has("student_id", s.id),
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const staff: StaffOption[] = (staffRes.data ?? []).filter((s) => !s.email)
    .map((s) => ({ id: s.id, name: s.full_name, role: STAFF_LABEL[s.role] ?? s.role }));
  const sections: SectionOption[] = scope.sections.map((s) => ({ id: s.id, label: `${s.class_name}-${s.name}` }));

  return <AccessAdmin rows={rows} staff={staff} sections={sections} />;
}
