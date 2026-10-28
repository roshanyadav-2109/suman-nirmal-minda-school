import { EmptyState } from "@/components/ui/empty";
import { guardTab } from "@/lib/access";

// Library: on its way. The tab is in place so everyone knows where it will live.
export default async function LibraryPage() {
  const denied = await guardTab("/dashboard/library");
  if (denied) return denied;
  return (
    <EmptyState art="coming-soon" title="Coming soon"
      hint="Book issue and return, and the library catalogue, are on their way." className="min-h-[60vh]" />
  );
}
