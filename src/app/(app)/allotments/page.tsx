import { createClient } from "@/lib/supabase/server";
import { getCurrentYear } from "@/lib/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { AllotmentsTable, type AllotRow } from "@/components/allotments/allotments-table";

export default async function AllotmentsPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const year = await getCurrentYear();

  const { data } = await supabase
    .from("teacher_allotment")
    .select("id, is_class_teacher, staff:staff_id(full_name), section:section_id(name, class:class_id(name, level)), subject:subject_id(name)")
    .eq("academic_year_id", year?.id ?? -1);

  const rows: AllotRow[] = (data ?? []).map((a) => {
    const sec = a.section as unknown as { name: string; class: { name: string; level: number } } | null;
    return {
      id: a.id,
      staffName: (a.staff as unknown as { full_name: string } | null)?.full_name ?? "—",
      className: sec?.class.name ?? "—",
      classLevel: sec?.class.level ?? 99,
      sectionLabel: sec ? `${sec.class.name}-${sec.name}` : "—",
      subject: (a.subject as unknown as { name: string } | null)?.name ?? null,
      isCt: a.is_class_teacher,
    };
  });

  return (
    <div>
      <PageHeader title={t("nav.allotments")} description={year?.name} />
      <AllotmentsTable rows={rows} />
    </div>
  );
}
