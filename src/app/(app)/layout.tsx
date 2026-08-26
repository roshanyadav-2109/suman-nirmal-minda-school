import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { AppShell } from "@/components/app-shell";
import type { NavRole } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { t } = await getT();
  const roleLabel = t(`roles.${session.navRole}`);
  return (
    <AppShell name={session.fullName} role={session.navRole as NavRole} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
