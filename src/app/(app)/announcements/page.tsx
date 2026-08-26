import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { fmtRelative } from "@/i18n/format";
import { EmptyState } from "@/components/ui/empty";
import { AnnounceIcon } from "@/components/icons";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementsGrid } from "@/components/announcements/announcements-grid";
import { getStaffScope } from "@/lib/data/scope";

const posterKey: Record<string, string> = { principal: "announce.byPrincipal", office: "announce.byOffice", class_teacher: "announce.byClassTeacher", subject_teacher: "announce.byTeacher" };
const scopeKey: Record<string, string> = { school: "announce.scopeSchool", class: "announce.scopeClass", section: "announce.scopeSection" };

export default async function AnnouncementsPage() {
  const session = (await getSession())!;
  const supabase = await createClient();
  const { t, locale } = await getT();

  const { data: items } = await supabase
    .from("announcement")
    .select("id, title, body, scope, published_at, class_id, section_id, staff:created_by(full_name, role)")
    .order("published_at", { ascending: false });

  const isStaff = !!session.staffId;
  const scope = isStaff ? await getStaffScope() : null;

  const gridItems = (items ?? []).map((a) => {
    const role = (a.staff as unknown as { full_name: string; role: string } | null)?.role ?? "subject_teacher";
    return {
      id: a.id,
      poster: t(posterKey[role] ?? "announce.byOffice"),
      time: fmtRelative(locale, a.published_at),
      title: a.title,
      body: a.body,
      scope: t(scopeKey[a.scope] ?? "announce.scopeSchool"),
    };
  });
  const feed = gridItems.length ? (
    <AnnouncementsGrid items={gridItems} />
  ) : (
    <EmptyState icon={AnnounceIcon} title={t("common.noData")} hint={isStaff ? t("announce.new") : undefined} />
  );

  if (!isStaff || !scope) return feed;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {feed}
      <AnnouncementForm sections={scope.sections} allowSchool={scope.isAdmin} />
    </div>
  );
}
