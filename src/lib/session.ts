import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { getReference } from "@/lib/data/reference";

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type ProfileRole = Database["public"]["Enums"]["profile_role"];
export type NavRole = "student" | "guardian" | "subject_teacher" | "class_teacher" | "principal" | "office" | "transport";

export type Session = {
  userId: string;
  role: ProfileRole;
  fullName: string;
  locale: string;
  staffId: number | null;
  guardianId: number | null;
  studentId: number | null;
  staffRole: StaffRole | null;
  // effective role for labels (from staff.role)
  effectiveRole: StaffRole | "student" | "guardian";
  isAdminScope: boolean; // principal or office
  isClassTeacher: boolean; // holds a class-teacher allotment this year (dynamic)
  // role used to build nav/quick-links: a staff member who class-teaches a
  // section is treated as class_teacher regardless of their static staff.role.
  navRole: NavRole;
};

// Load the signed-in user's profile (RLS: self-read). Returns null if signed out.
// Cached per request so the profile query runs once even though layout, page and
// data helpers all ask for the session. The identity comes from getClaims(),
// which verifies the JWT locally against the cached signing key — no auth-server
// round trip (the proxy has already refreshed the cookie if it had expired).
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;
  if (!userId) return null;
  const user = { id: userId };

  // The profile and the current year do not depend on each other, and the year
  // is wanted by nearly every page anyway (getCurrentYear caches it per request),
  // so fetch them together rather than one after the other.
  const [{ data }, year] = await Promise.all([
    supabase
      .from("profile")
      .select("id, role, full_name, locale, staff_id, guardian_id, student_id, staff:staff_id(role, email, teacher_allotment(academic_year_id, is_class_teacher)), guardian:guardian_id(email), student:student_id(email)")
      .eq("id", user.id)
      .single(),
    getCurrentYear(),
  ]);
  if (!data) return null;

  // Google sign-in follows the email on the school record: once the office
  // changes or removes it, a Google login stops working straight away.
  const providers = (claims?.app_metadata as { providers?: string[] } | undefined)?.providers ?? [];
  if (providers.includes("google")) {
    const recordEmail =
      (data.staff as { email: string | null } | null)?.email ??
      (data.guardian as { email: string | null } | null)?.email ??
      (data.student as { email: string | null } | null)?.email ?? null;
    const signedInAs = typeof claims?.email === "string" ? claims.email : "";
    if (!recordEmail || recordEmail.trim().toLowerCase() !== signedInAs.trim().toLowerCase()) return null;
  }

  const staffRole = (data.staff as { role: StaffRole } | null)?.role ?? null;
  const effectiveRole: Session["effectiveRole"] =
    data.role === "staff" ? (staffRole ?? "office") : data.role;

  // Is this staff member a class teacher of any section in the current year?
  // Their allotments come with the profile, so this costs no extra trip.
  const allots = (data.staff as { teacher_allotment?: { academic_year_id: number; is_class_teacher: boolean }[] } | null)?.teacher_allotment ?? [];
  const isClassTeacher = !!year && allots.some((a) => a.is_class_teacher && a.academic_year_id === year.id);

  const navRole: NavRole = isClassTeacher ? "class_teacher" : (effectiveRole as NavRole);

  return {
    userId: data.id,
    role: data.role,
    fullName: data.full_name,
    locale: data.locale,
    staffId: data.staff_id,
    guardianId: data.guardian_id,
    studentId: data.student_id,
    staffRole,
    effectiveRole,
    isAdminScope: staffRole === "principal" || staffRole === "office",
    isClassTeacher,
    navRole,
  };
});

// A student's identity card: gender, roll no, class-section label (e.g. "VIII-A")
// and the section's class teacher. Cached per request. Null if not enrolled.
export type Gender = Database["public"]["Enums"]["gender_type"];
export type StudentCard = { gender: Gender | null; roll: number | null; classSection: string | null; classTeacher: string | null };
export const getStudentCard = cache(async (studentId: number): Promise<StudentCard | null> => {
  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) return null;
  const { data: enr } = await supabase
    .from("student_enrollment")
    .select("roll_no, section_id, section:section_id(name, class:class_id(name)), student:student_id(gender)")
    .eq("student_id", studentId)
    .eq("academic_year_id", year.id)
    .single();
  if (!enr) return null;
  const sec = enr.section as unknown as { name: string; class: { name: string } | null } | null;
  const classSection = sec ? (sec.class ? `${sec.class.name}-${sec.name}` : sec.name) : null;
  const gender = (enr.student as unknown as { gender: Gender | null } | null)?.gender ?? null;

  let classTeacher: string | null = null;
  if (enr.section_id) {
    const { data: ct } = await supabase
      .from("teacher_allotment")
      .select("staff:staff_id(full_name)")
      .eq("section_id", enr.section_id)
      .eq("academic_year_id", year.id)
      .eq("is_class_teacher", true)
      .limit(1)
      .maybeSingle();
    classTeacher = (ct?.staff as unknown as { full_name: string } | null)?.full_name ?? null;
  }
  return { gender, roll: enr.roll_no, classSection, classTeacher };
});

// Current academic year — from the shared reference copy (no database trip).
export const getCurrentYear = cache(async () => (await getReference()).currentYear);
