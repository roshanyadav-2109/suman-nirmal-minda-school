import { getSession } from "@/lib/session";
import { navFor, type NavRole } from "@/lib/nav";
import { EmptyState } from "@/components/ui/empty";

// Pages that aren't in a role's side menu but that role still uses.
const EXTRA: Record<string, NavRole[]> = {
  "/dashboard/search": ["student", "guardian", "subject_teacher", "class_teacher", "principal", "office"],
  "/dashboard/feedback": ["guardian", "class_teacher", "principal"],
};

// May this person open the tab at `href`? The same rule as their side menu, so
// typing or sharing an address can't open a page their role doesn't have.
// (What a page then shows is still limited by the database's row rules.)
export function roleCanOpen(role: NavRole, href: string): boolean {
  if (EXTRA[href]) return EXTRA[href].includes(role);
  return navFor(role).some((i) => i.href === href);
}

// Called at the top of every dashboard page: returns the "no access" screen to
// show instead, or null when the person may see the page.
export async function guardTab(href: string): Promise<React.ReactNode | null> {
  const session = await getSession();
  if (session && roleCanOpen(session.navRole, href)) return null;
  return (
    <EmptyState
      art="no-results"
      title="You don't have access to this page"
      hint="This link is for a different role. Ask the person who shared it, or use the menu to find your own pages."
    />
  );
}
