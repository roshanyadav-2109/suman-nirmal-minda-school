import { guardTab } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { ManageTabs } from "@/components/manage/manage-tabs";

// Manage School: where the office keeps the school's records up to date.
// Office only; anyone else who opens the address sees a "no access" note. (The database's
// own rules also refuse these changes from anyone but office/principal.)
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardTab("/dashboard/manage");
  if (denied) return denied;
  return (
    <div>
      <PageHeader title="Manage School" />
      <ManageTabs />
      {children}
    </div>
  );
}
