import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type ProfileRole = Database["public"]["Enums"]["profile_role"];
export type NavRole = "student" | "guardian" | "subject_teacher" | "class_teacher" | "principal" | "office";

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
// Cached per request so the auth.getUser() network call + profile query run once
// even though layout, page and data helpers all ask for the session.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profile")
    .select("id, role, full_name, locale, staff_id, guardian_id, student_id, staff:staff_id(role)")
    .eq("id", user.id)
    .single();
  if (!data) return null;

  const staffRole = (data.staff as { role: StaffRole } | null)?.role ?? null;
  const effectiveRole: Session["effectiveRole"] =
    data.role === "staff" ? (staffRole ?? "office") : data.role;

  // Is this staff member a class teacher of any section in the current year?
  let isClassTeacher = false;
  if (data.staff_id) {
    const { data: cy } = await supabase.from("academic_year").select("id").eq("is_current", true).single();
    if (cy) {
      const { count } = await supabase
        .from("teacher_allotment")
        .select("id", { count: "exact", head: true })
        .eq("staff_id", data.staff_id)
        .eq("is_class_teacher", true)
        .eq("academic_year_id", cy.id);
      isClassTeacher = (count ?? 0) > 0;
    }
  }

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
  const { data: year } = await supabase.from("academic_year").select("id").eq("is_current", true).single();
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

// Current academic year (readable by all authenticated users). Cached per request.
export const getCurrentYear = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_year")
    .select("id, name")
    .eq("is_current", true)
    .single();
  return data;
});
