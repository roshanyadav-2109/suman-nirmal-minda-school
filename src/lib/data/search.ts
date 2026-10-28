import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";
import { navFor, type NavRole } from "@/lib/nav";
import { getT } from "@/i18n/server";

// One search across the portal. What comes back depends on who is asking:
// the database's own rules (RLS) already limit students, sections and notices
// to the person's scope, and staff-only groups are skipped for families.

export type SearchHit = { href: string | null; title: string; detail?: string };
export type SearchGroup = { key: "pages" | "students" | "staff" | "sections" | "notices"; label: string; hits: SearchHit[] };

const STAFF_ROLES: NavRole[] = ["principal", "office", "class_teacher", "subject_teacher"];

// Characters that would break PostgREST's filter syntax are dropped.
const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export async function searchEverything(rawQuery: string, perGroup = 6): Promise<SearchGroup[]> {
  const q = clean(rawQuery);
  if (q.length < 2) return [];
  const session = await getSession();
  if (!session) return [];
  const { t } = await getT();
  const supabase = await createClient();
  const role = session.navRole as NavRole;
  const isStaff = STAFF_ROLES.includes(role);
  const lower = q.toLowerCase();

  // Pages: the person's own menu, matched on its label.
  const pages: SearchHit[] = navFor(role)
    .filter((n) => t(n.labelKey).toLowerCase().includes(lower))
    .map((n) => ({ href: n.href, title: t(n.labelKey), detail: t("x.searchPage") }));

  const year = await getCurrentYear();

  const [studentsRes, staffRes, sectionsRes, noticesRes] = await Promise.all([
    supabase.from("student").select("id, full_name, admission_no")
      .or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`).order("full_name").limit(perGroup),
    isStaff
      ? supabase.from("staff").select("id, full_name, role, employee_code")
          .or(`full_name.ilike.%${q}%,employee_code.ilike.%${q}%`).order("full_name").limit(perGroup)
      : Promise.resolve({ data: [] as { id: number; full_name: string; role: string; employee_code: string | null }[] }),
    isStaff
      ? supabase.from("section").select("id, name, class:class_id(name, level)")
      : Promise.resolve({ data: [] as { id: number; name: string; class: unknown }[] }),
    supabase.from("announcement").select("id, title, published_at").ilike("title", `%${q}%`)
      .order("published_at", { ascending: false }).limit(perGroup),
  ]);

  // Students, with this year's class, section and roll number.
  const studentRows = studentsRes.data ?? [];
  let enrolment = new Map<number, { section_id: number; roll_no: number | null; label: string }>();
  if (studentRows.length && year) {
    const { data } = await supabase.from("student_enrollment")
      .select("student_id, section_id, roll_no, section:section_id(name, class:class_id(name))")
      .eq("academic_year_id", year.id).in("student_id", studentRows.map((s) => s.id));
    enrolment = new Map((data ?? []).map((e) => {
      const sec = e.section as unknown as { name: string; class: { name: string } | null } | null;
      return [e.student_id, { section_id: e.section_id, roll_no: e.roll_no, label: sec ? `${sec.class?.name ?? ""}-${sec.name}` : "" }];
    }));
  }
  const students: SearchHit[] = studentRows.map((s) => {
    const e = enrolment.get(s.id);
    const bits = [s.admission_no, e?.label, e?.roll_no != null ? `${t("dashboard.rollNo")} ${e.roll_no}` : null].filter(Boolean);
    const href = isStaff
      ? (e && year ? `/dashboard/progress?studentId=${s.id}&section=${e.section_id}&year=${year.id}` : `/dashboard/progress?studentId=${s.id}`)
      : `/dashboard/progress?child=${s.id}`;
    return { href, title: s.full_name, detail: bits.join(" · ") };
  });

  // Staff, with what they teach this year (an admin sees everyone's; a teacher
  // sees only their own assignments, so colleagues show by name and role).
  const staffRows = staffRes.data ?? [];
  let teaches = new Map<number, string[]>();
  if (staffRows.length && year) {
    const { data } = await supabase.from("teacher_allotment")
      .select("staff_id, is_class_teacher, subject:subject_id(name), section:section_id(name, class:class_id(name))")
      .eq("academic_year_id", year.id).in("staff_id", staffRows.map((s) => s.id));
    teaches = new Map();
    for (const a of data ?? []) {
      const sec = a.section as unknown as { name: string; class: { name: string } | null } | null;
      const subj = (a.subject as unknown as { name: string } | null)?.name;
      const label = `${sec ? `${sec.class?.name ?? ""}-${sec.name}` : ""}${a.is_class_teacher ? ` (${t("roles.class_teacher")})` : subj ? ` ${subj}` : ""}`;
      const list = teaches.get(a.staff_id) ?? [];
      list.push(label.trim());
      teaches.set(a.staff_id, list);
    }
  }
  const staff: SearchHit[] = staffRows.map((s) => {
    const list = teaches.get(s.id) ?? [];
    const role = t(`roles.${s.role}`);
    const detail = list.length ? `${role} · ${list.slice(0, 3).join(", ")}${list.length > 3 ? ` +${list.length - 3}` : ""}` : role;
    return { href: session.isAdminScope ? `/dashboard/allotments?teacher=${encodeURIComponent(s.full_name)}` : null, title: s.full_name, detail };
  });

  // Classes and sections: "VIII", "viii-b", "XI-Sci".
  const norm = (x: string) => x.toLowerCase().replace(/[\s-]/g, "");
  const sections: SearchHit[] = ((sectionsRes.data ?? []) as { id: number; name: string; class: unknown }[])
    .map((s) => { const c = s.class as { name: string; level: number } | null; return { id: s.id, label: `${c?.name ?? ""}-${s.name}`, level: c?.level ?? 99 }; })
    .filter((s) => norm(s.label).startsWith(norm(q)))
    .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label))
    .slice(0, perGroup)
    .map((s) => ({ href: `/dashboard/students?section=${s.id}`, title: s.label, detail: t("x.searchSection") }));

  const notices: SearchHit[] = (noticesRes.data ?? []).map((a) => ({ href: "/dashboard/announcements", title: a.title, detail: t("announce.title") }));

  const groups: SearchGroup[] = [
    { key: "pages", label: t("x.searchGroupPages"), hits: pages },
    { key: "students", label: t("common.students"), hits: students },
    { key: "staff", label: t("x.searchGroupStaff"), hits: staff },
    { key: "sections", label: t("x.searchGroupSections"), hits: sections },
    { key: "notices", label: t("announce.title"), hits: notices },
  ];
  return groups.filter((g) => g.hits.length);
}
