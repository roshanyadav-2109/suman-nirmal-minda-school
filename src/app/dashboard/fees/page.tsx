import { EmptyState } from "@/components/ui/empty";
import { guardTab } from "@/lib/access";

// Fees: on its way. The tab is in place so everyone knows where it will live.
export default async function FeesPage() {
  const denied = await guardTab("/dashboard/fees");
  if (denied) return denied;
  return (
    <EmptyState art="coming-soon" title="Coming soon"
      hint="Fee details, receipts and online payment are on their way." className="min-h-[60vh]" />
  );
}
