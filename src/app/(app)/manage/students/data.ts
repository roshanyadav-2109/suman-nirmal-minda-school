import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Gender } from "./rules";

// What the student screens show for one student this year: their details,
// their current-year class, and their first (primary) parent.
export type StudentRecord = {
  id: number;
  fullName: string;
  admissionNo: string;
  dob: string | null;
  gender: Gender | null;
  sectionId: number | null;
  classSection: string | null;
  rollNo: number | null;
  left: boolean;
  guardian: { id: number; fullName: string; relation: string | null; phone: string | null; email: string | null } | null;
};

export type StudentList = { rows: StudentRecord[]; total: number; page: number; pageSize: number };

export const PAGE_SIZE = 50;

type GuardianRow = { id: number; full_name: string; relation: string | null; phone: string | null; email: string | null };
type Raw = {
  id: number; full_name: string; admission_no: string; dob: string | null; gender: Gender | null;
  student_enrollment: { section_id: number; roll_no: number | null; status: string; academic_year_id: number;
    section: { name: string; class: { name: string } | null } | null }[];
  guardian_student: { is_primary: boolean; guardian: GuardianRow | null }[];
};

const SELECT =
  "id, full_name, admission_no, dob, gender, " +
  "student_enrollment!inner(section_id, roll_no, status, academic_year_id, section:section_id(name, class:class_id(name))), " +
  "guardian_student(is_primary, guardian:guardian_id(id, full_name, relation, phone, email))";

function toRecord(r: Raw): StudentRecord {
  const e = r.student_enrollment[0];
  const sec = e?.section ?? null;
  const links = [...(r.guardian_student ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const g = links.find((l) => l.guardian)?.guardian ?? null;
  return {
    id: r.id,
    fullName: r.full_name,
    admissionNo: r.admission_no,
    dob: r.dob,
    gender: r.gender,
    sectionId: e?.section_id ?? null,
    classSection: sec ? (sec.class ? `${sec.class.name}-${sec.name}` : sec.name) : null,
    rollNo: e?.roll_no ?? null,
    left: e?.status === "transferred",
    guardian: g ? { id: g.id, fullName: g.full_name, relation: g.relation, phone: g.phone, email: g.email } : null,
  };
}

// Current-year students for the office list, newest filters applied, one page
// at a time. RLS limits what anyone but office/principal would see.
export async function listStudents(opts: {
  yearId: number; sectionId: number | null; q: string; left: boolean; page: number;
}): Promise<StudentList> {
  const supabase = await createClient();
  const from = opts.page * PAGE_SIZE;
  let query = supabase
    .from("student")
    .select(SELECT, { count: "exact" })
    .eq("student_enrollment.academic_year_id", opts.yearId);
  query = opts.left
    ? query.eq("student_enrollment.status", "transferred")
    : query.neq("student_enrollment.status", "transferred");
  if (opts.sectionId) query = query.eq("student_enrollment.section_id", opts.sectionId);
  // Characters that would break the filter syntax are dropped, not escaped.
  const term = opts.q.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
  if (term) query = query.or(`full_name.ilike.%${term}%,admission_no.ilike.%${term}%`);
  const { data, count } = await query.order("full_name").range(from, from + PAGE_SIZE - 1);
  return {
    rows: ((data ?? []) as unknown as Raw[]).map(toRecord),
    total: count ?? 0,
    page: opts.page,
    pageSize: PAGE_SIZE,
  };
}

// Full details for a set of students (a class roster), keyed by id.
export async function getStudentRecords(ids: number[], yearId: number): Promise<Map<number, StudentRecord>> {
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("student")
    .select(SELECT)
    .eq("student_enrollment.academic_year_id", yearId)
    .in("id", ids);
  return new Map(((data ?? []) as unknown as Raw[]).map((r) => [r.id, toRecord(r)]));
}
