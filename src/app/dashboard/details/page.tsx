import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { guardTab } from "@/lib/access";
import { MyDetailsForm } from "@/components/details/my-details-form";
import { loadMyDetails } from "./actions";

// A student's own details: everything the school holds, with only their phone
// and their parents' phone and email open to change.
export default async function DetailsPage() {
  const denied = await guardTab("/dashboard/details");
  if (denied) return denied;
  const details = await loadMyDetails();
  return (
    <div>
      <PageHeader title="Personal details" />
      {details
        ? <MyDetailsForm details={details} />
        : <EmptyState art="nothing-yet" title="Your details aren't available" hint="Please ask the school office." />}
    </div>
  );
}
