import { getSession } from "@/lib/session";
import { getAnnouncements, getSectionLabels } from "@/lib/data/announcements";
import { getT } from "@/i18n/server";
import { fmtRelative } from "@/i18n/format";
import { EmptyState } from "@/components/ui/empty";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementsGrid } from "@/components/announcements/announcements-grid";
import { getStaffScope } from "@/lib/data/scope";

const posterKey: Record<string, string> = { principal: "announce.byPrincipal", office: "announce.byOffice", class_teacher: "announce.byClassTeacher", subject_teacher: "announce.byTeacher" };

export default async function AnnouncementsPage() {
  const session = (await getSession())!;
  const { t, locale } = await getT();

  const items = await getAnnouncements();
  const isStaff = !!session.staffId;
  const [scope, labels] = await Promise.all([
    isStaff ? getStaffScope() : Promise.resolve(null),
    getSectionLabels(items.flatMap((a) => a.section_ids ?? (a.section_id ? [a.section_id] : []))),
  ]);

  // Who an announcement is for, in words: "Whole school", "VIII-A",
  // or "VIII-A, VIII-B, IX-A +3 more".
  const audience = (a: (typeof items)[number]) => {
    if (a.scope === "school") return t("announce.scopeSchool");
    if (a.scope === "class") return t("announce.scopeClass");
    const ids = a.section_ids ?? (a.section_id ? [a.section_id] : []);
    const names = ids.map((id) => labels.get(id)).filter(Boolean) as string[];
    if (!names.length) return t("announce.scopeSection");
    return names.length > 4 ? `${names.slice(0, 4).join(", ")} ${t("announce.sectionsMore", { n: names.length - 4 })}` : names.join(", ");
  };

  const gridItems = items.map((a) => {
    const role = a.staff?.role ?? "subject_teacher";
    return {
      id: a.id,
      poster: t(posterKey[role] ?? "announce.byOffice"),
      time: fmtRelative(locale, a.published_at),
      title: a.title,
      body: a.body,
      scope: audience(a),
      imageUrl: a.image_url,
    };
  });
  const feed = gridItems.length ? (
    <AnnouncementsGrid items={gridItems} />
  ) : (
    <EmptyState title={t("common.noData")} hint={isStaff ? t("announce.new") : undefined} />
  );

  if (!isStaff || !scope) return feed;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {feed}
      <AnnouncementForm sections={scope.sections} allowSchool={scope.isAdmin} />
    </div>
  );
}
