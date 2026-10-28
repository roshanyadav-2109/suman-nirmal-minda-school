"use server";
import { revalidatePath } from "next/cache";
import { getCurrentYear, getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// A student's own "Personal details". Students may not write school records
// directly, so this runs on the server with the service key — but only ever on
// the signed-in student's own record and their own parents, and only for the
// fields they are allowed to change: their phone, and their parents' phone and
// email. Everything else is shown, not changed.

export type ParentDetails = { id: number; name: string; relation: string | null; phone: string | null; email: string | null; isPrimary: boolean };
export type MyDetails = {
  name: string;
  admissionNo: string;
  dob: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  classSection: string | null;
  rollNo: number | null;
  classTeacher: string | null;
  schoolYear: string | null;
  parents: ParentDetails[];
};
export type SaveInput = { phone: string; parents: { id: number; phone: string; email: string }[] };
export type Result = { ok: true } | { ok: false; error: string };

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_OK = /^[+\d][\d\s-]{6,19}$/;
const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

export async function loadMyDetails(): Promise<MyDetails | null> {
  const session = await getSession();
  if (session?.role !== "student" || !session.studentId) return null;
  const admin = createAdminClient();
  const year = await getCurrentYear();
  const [{ data: s }, { data: enr }, { data: links }] = await Promise.all([
    admin.from("student").select("full_name, admission_no, dob, gender, email, phone").eq("id", session.studentId).single(),
    year
      ? admin.from("student_enrollment").select("roll_no, section_id, section:section_id(name, class:class_id(name))")
          .eq("student_id", session.studentId).eq("academic_year_id", year.id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("guardian_student").select("is_primary, guardian:guardian_id(id, full_name, relation, phone, email)").eq("student_id", session.studentId),
  ]);
  if (!s) return null;

  const sec = (enr as { section: { name: string; class: { name: string } | null } | null } | null)?.section ?? null;
  let classTeacher: string | null = null;
  if (enr && year) {
    const { data: ct } = await admin.from("teacher_allotment").select("staff:staff_id(full_name)")
      .eq("section_id", (enr as { section_id: number }).section_id).eq("academic_year_id", year.id).eq("is_class_teacher", true).limit(1).maybeSingle();
    classTeacher = (ct?.staff as { full_name: string } | null)?.full_name ?? null;
  }

  const parents = ((links ?? []) as unknown as { is_primary: boolean; guardian: { id: number; full_name: string; relation: string | null; phone: string | null; email: string | null } | null }[])
    .filter((l) => l.guardian)
    .map((l) => ({ id: l.guardian!.id, name: l.guardian!.full_name, relation: l.guardian!.relation, phone: l.guardian!.phone, email: l.guardian!.email, isPrimary: l.is_primary }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  return {
    name: s.full_name,
    admissionNo: s.admission_no,
    dob: s.dob,
    gender: s.gender,
    email: s.email,
    phone: s.phone,
    classSection: sec ? `${sec.class?.name ?? ""}-${sec.name}` : null,
    rollNo: (enr as { roll_no: number | null } | null)?.roll_no ?? null,
    classTeacher,
    schoolYear: year?.name ?? null,
    parents,
  };
}

export async function saveMyDetails(input: SaveInput): Promise<Result> {
  const session = await getSession();
  if (session?.role !== "student" || !session.studentId) return { ok: false, error: "Only a student can change these details." };
  const admin = createAdminClient();

  const phone = tidy(input.phone);
  if (phone && !PHONE_OK.test(phone)) return { ok: false, error: "Your phone number does not look right." };

  // Only parents actually linked to this student.
  const { data: links } = await admin.from("guardian_student").select("guardian_id").eq("student_id", session.studentId);
  const mine = new Set((links ?? []).map((l) => l.guardian_id));
  for (const p of input.parents) {
    if (!mine.has(p.id)) return { ok: false, error: "You can only change your own parents' details." };
    const ph = tidy(p.phone), em = tidy(p.email).toLowerCase();
    if (ph && !PHONE_OK.test(ph)) return { ok: false, error: "A parent's phone number does not look right." };
    if (em && !EMAIL_OK.test(em)) return { ok: false, error: "A parent's email does not look right." };
    if (em) {
      // One email = one person's sign-in, so it can't already belong to someone else.
      const exact = em.replace(/[\\%_]/g, (c) => `\\${c}`);
      const [st, gu, su] = await Promise.all([
        admin.from("staff").select("id").ilike("email", exact).limit(1),
        admin.from("guardian").select("id").ilike("email", exact).neq("id", p.id).limit(1),
        admin.from("student").select("id").ilike("email", exact).limit(1),
      ]);
      if (st.data?.length || gu.data?.length || su.data?.length) return { ok: false, error: `${em} is already used by someone else at the school.` };
    }
  }

  const { error } = await admin.from("student").update({ phone: phone || null }).eq("id", session.studentId);
  if (error) return { ok: false, error: "Could not save. Please try again." };
  for (const p of input.parents) {
    const { error: gErr } = await admin.from("guardian")
      .update({ phone: tidy(p.phone) || null, email: tidy(p.email).toLowerCase() || null }).eq("id", p.id);
    if (gErr) return { ok: false, error: "Your phone was saved, but a parent's details could not be. Please try again." };
  }
  revalidatePath("/dashboard/details");
  return { ok: true };
}
