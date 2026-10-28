import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ManageTabs } from "@/components/manage/manage-tabs";

// Manage School: where the office keeps the school's records up to date.
// Office only; everyone else is sent back to their dashboard. (The database's
// own rules also refuse these changes from anyone but office/principal.)
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.staffRole !== "office") redirect("/");
  return (
    <div>
      <PageHeader title="Manage School" />
      <ManageTabs />
      {children}
    </div>
  );
}
