"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentYear, getSession } from "@/lib/session";
import { setClassTeacher } from "@/app/dashboard/manage/teachers/actions";

// Manage School → Give access. The office puts a name and an email against a
// dashboard; that person then signs in with Google using the email. Access is
// simply the email on a school record (staff, parent or student), so removing
// the email takes the access away again.

export type Dashboard = "principal" | "office" | "subject_teacher" | "class_teacher" | "transport" | "guardian" | "student";
export type Result = { ok: true; message?: string } | { ok: false; error: string };
export type StudentHit = { id: number; name: string; admissionNo: string; classSection: string | null; email: string | null };
export type ParentOption = { id: number; name: string; relation: string | null; email: string | null; children: string[] };

export type GiveAccessInput = {
  dashboard: Dashboard;
  email: string;
  fullName: string;           // new staff member / new parent
  staffId: number | null;     // an existing staff member instead of a new one
  sectionId: number | null;   // class teacher of
  studentIds: number[];       // parent: their children; student: the one student
  guardianId: number | null;  // parent: an existing parent record instead of a new one
  relation: string;           // parent: Father, Mother…
};

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_DASHBOARDS: Dashboard[] = ["principal", "office", "subject_teacher", "class_teacher", "transport"];

async function officeOnly() {
  const session = await getSession();
  return session?.staffRole === "office";
}

function refresh() {
  revalidatePath("/dashboard/manage/access");
  revalidatePath("/dashboard/manage/teachers");
  revalidatePath("/dashboard/manage/students");
}

const exact = (email: string) => email.replace(/[\\%_]/g, (c) => `\\${c}`);

// Who already has this email, in words, or null when nobody does.
async function emailTakenBy(supabase: Awaited<ReturnType<typeof createClient>>, email: string): Promise<string | null> {
  const [st, gu, su] = await Promise.all([
    supabase.from("staff").select("full_name").ilike("email", exact(email)).limit(1),
    supabase.from("guardian").select("full_name").ilike("email", exact(email)).limit(1),
    supabase.from("student").select("full_name").ilike("email", exact(email)).limit(1),
  ]);
  const who = st.data?.[0]?.full_name ?? gu.data?.[0]?.full_name ?? su.data?.[0]?.full_name;
  return who ?? null;
}

export async function giveAccess(input: GiveAccessInput): Promise<Result> {
  if (!(await officeOnly())) return { ok: false, error: "Only the school office can give access." };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return { ok: false, error: "Please type a proper email address, like name@gmail.com." };
  const supabase = await createClient();

  const taken = await emailTakenBy(supabase, email);
  if (taken) return { ok: false, error: `${email} already gives access to ${taken}. Remove that first, or use a different email.` };

  const name = input.fullName.replace(/\s+/g, " ").trim();

  // Staff dashboards: a new staff record, or the email on an existing one.
  if (STAFF_DASHBOARDS.includes(input.dashboard)) {
    if (input.dashboard === "class_teacher" && !input.sectionId) return { ok: false, error: "Please choose the class they are class teacher of." };
    const role = input.dashboard === "class_teacher" ? "class_teacher" : input.dashboard;
    let staffId = input.staffId;
    if (staffId) {
      const { error } = await supabase.from("staff").update({ email, role: role as never }).eq("id", staffId);
      if (error) return { ok: false, error: "Could not save. Please try again." };
    } else {
      if (!name) return { ok: false, error: "Please type the person's full name." };
      const { data, error } = await supabase.from("staff").insert({ full_name: name, email, role: role as never }).select("id").single();
      if (error || !data) return { ok: false, error: "Could not save. Please try again." };
      staffId = data.id;
    }
    if (input.dashboard === "class_teacher" && input.sectionId) {
      const ct = await setClassTeacher({ sectionId: input.sectionId, staffId });
      if (!ct.ok) { refresh(); return { ok: false, error: `Access was given, but they could not be made class teacher: ${ct.error}` }; }
    }
    refresh();
    return { ok: true };
  }

  // Parent: a new parent record linked to their children, or the email on an existing parent.
  if (input.dashboard === "guardian") {
    if (!input.studentIds.length) return { ok: false, error: "Please choose their child (or children)." };
    let guardianId = input.guardianId;
    if (guardianId) {
      const { error } = await supabase.from("guardian").update({ email }).eq("id", guardianId);
      if (error) return { ok: false, error: "Could not save. Please try again." };
    } else {
      if (!name) return { ok: false, error: "Please type the parent's full name." };
      const { data, error } = await supabase.from("guardian")
        .insert({ full_name: name, email, relation: input.relation.trim() || null }).select("id").single();
      if (error || !data) return { ok: false, error: "Could not save. Please try again." };
      guardianId = data.id;
    }
    const { data: links } = await supabase.from("guardian_student").select("student_id, guardian_id").in("student_id", input.studentIds);
    const linked = new Set((links ?? []).filter((l) => l.guardian_id === guardianId).map((l) => l.student_id));
    const hasParent = new Set((links ?? []).map((l) => l.student_id));
    const add = input.studentIds.filter((id) => !linked.has(id))
      .map((student_id) => ({ guardian_id: guardianId!, student_id, is_primary: !hasParent.has(student_id) }));
    if (add.length) {
      const { error } = await supabase.from("guardian_student").insert(add);
      if (error) { refresh(); return { ok: false, error: "The parent was saved, but could not be linked to every child. Please try again." }; }
    }
    refresh();
    return { ok: true };
  }

  // Student: the email goes on their own record.
  if (input.dashboard === "student") {
    const id = input.studentIds[0];
    if (!id) return { ok: false, error: "Please choose the student." };
    const { data, error } = await supabase.from("student").update({ email }).eq("id", id).select("id");
    if (error || !data?.length) return { ok: false, error: "Could not save. Please try again." };
    refresh();
    return { ok: true };
  }

  return { ok: false, error: "Please choose a dashboard." };
}

// Taking access away = taking the email off the record. A Google login stops
// working at once (the session check compares the record's email).
export async function removeAccess(kind: "staff" | "guardian" | "student", id: number): Promise<Result> {
  if (!(await officeOnly())) return { ok: false, error: "Only the school office can remove access." };
  const supabase = await createClient();
  const { data, error } = await supabase.from(kind).update({ email: null }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Could not remove access. Please try again." };
  refresh();
  return { ok: true };
}

// Up to 10 students this year whose name or admission no matches.
export async function findStudents(q: string): Promise<StudentHit[]> {
  if (!(await officeOnly())) return [];
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  const year = await getCurrentYear();
  const { data } = await supabase
    .from("student")
    .select("id, full_name, admission_no, email, student_enrollment(academic_year_id, section:section_id(name, class:class_id(name)))")
    .or(`full_name.ilike.%${term}%,admission_no.ilike.%${term}%`)
    .order("full_name")
    .limit(10);
  return ((data ?? []) as unknown as {
    id: number; full_name: string; admission_no: string; email: string | null;
    student_enrollment: { academic_year_id: number; section: { name: string; class: { name: string } | null } | null }[];
  }[]).map((s) => {
    const e = s.student_enrollment.find((x) => x.academic_year_id === year?.id) ?? null;
    const sec = e?.section;
    return {
      id: s.id, name: s.full_name, admissionNo: s.admission_no, email: s.email,
      classSection: sec ? `${sec.class?.name ?? ""}-${sec.name}` : null,
    };
  });
}

// The parent records already linked to these children, so the office can put
// the email on the right one instead of making a duplicate.
export async function parentsOf(studentIds: number[]): Promise<ParentOption[]> {
  if (!(await officeOnly()) || !studentIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("guardian_student")
    .select("guardian:guardian_id(id, full_name, relation, email), student:student_id(full_name)")
    .in("student_id", studentIds);
  const byId = new Map<number, ParentOption>();
  for (const l of (data ?? []) as unknown as { guardian: { id: number; full_name: string; relation: string | null; email: string | null } | null; student: { full_name: string } | null }[]) {
    if (!l.guardian) continue;
    const p = byId.get(l.guardian.id) ?? { id: l.guardian.id, name: l.guardian.full_name, relation: l.guardian.relation, email: l.guardian.email, children: [] };
    if (l.student) p.children.push(l.student.full_name);
    byId.set(l.guardian.id, p);
  }
  return [...byId.values()];
}
