import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { BusIcon } from "@/components/icons";
import { ConductorConsole } from "@/components/transport/conductor-console";
import { getCrewContext } from "@/lib/data/transport";

export default async function ConductorPage() {
  const session = (await getSession())!;
  const { t } = await getT();

  // Crew and office only. RLS would refuse the writes anyway; this keeps a
  // parent from landing on a screen full of buttons that cannot work.
  if (session.effectiveRole !== "transport" && !session.isAdminScope) redirect("/transport");

  const ctx = await getCrewContext();
  if (!ctx) {
    return (
      <div>
        <PageHeader title={t("transport.console")} />
        <EmptyState icon={BusIcon} title={t("transport.noBusAssigned")} hint={t("transport.noBusAssignedHint")} />
      </div>
    );
  }

  return (
    // Phone-first, but the office opens this on a monitor too: one column below
    // md, two inside a readable width above it.
    <div className="mx-auto max-w-md md:max-w-4xl">
      <PageHeader title={t("transport.console")} description={t("transport.consoleIntro")} />
      <ConductorConsole ctx={ctx} labels={{
        morning: t("transport.morning"), afternoon: t("transport.afternoon"),
        startTrip: t("transport.startTrip"), endTrip: t("transport.endTrip"),
        keepAwake: t("transport.keepAwake"), gps: t("transport.gps"),
        queued: t("transport.queued"), lastSent: t("transport.lastSent"),
        arrived: t("transport.arrived"), riders: t("transport.riders"),
        noGps: t("transport.noGps"), ok: t("transport.ok"),
        next: t("transport.next"), endBlocked: t("transport.endBlocked"),
        nextStop: t("transport.nextStop"),
        stopsDone: t("transport.stopsDone"), notSending: t("transport.notSending"),
        // Left as the raw "{n}s ago" template: the console fills n in every second.
        secondsAgo: t("transport.secondsAgo"),
      }} />
    </div>
  );
}
