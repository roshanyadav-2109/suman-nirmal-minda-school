import { getT } from "@/i18n/server";
import { EmptyState } from "@/components/ui/empty";
import { TRANSPORT_ENABLED } from "@/lib/features";

// Every transport route (fleet board, bus riders, conductor console) sits under
// this layout, so one switch holds the whole feature back until launch.
export default async function TransportLayout({ children }: { children: React.ReactNode }) {
  if (TRANSPORT_ENABLED) return children;
  const { t } = await getT();
  return (
    <EmptyState art="coming-soon-transport" title={t("transport.comingSoon")} hint={t("transport.comingSoonHint")} className="min-h-[60vh]" />
  );
}
