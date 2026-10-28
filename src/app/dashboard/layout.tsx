import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { AppShell } from "@/components/app-shell";
import type { NavRole } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Signed in but with no school record behind the login (or a Google email
  // the office has since changed): sign them out properly, with a reason.
  if (!session) redirect("/auth/signout?error=google_not_registered");
  const { t } = await getT();
  const roleLabel = t(`roles.${session.navRole}`);
  return (
    <AppShell name={session.fullName} role={session.navRole as NavRole} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
