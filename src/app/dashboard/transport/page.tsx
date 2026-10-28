import Link from "next/link";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody } from "@/components/ui/card";
import { RideTracker } from "@/components/transport/ride-tracker";
import { FleetBoard } from "@/components/transport/fleet-board";
import { getMyRides, getFleet, getFleetSummary, getCrewContext } from "@/lib/data/transport";
import { numParam } from "@/lib/utils";
import { guardTab } from "@/lib/access";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function TransportPage({ searchParams }: { searchParams: SP }) {
  const denied = await guardTab("/dashboard/transport");
  if (denied) return denied;
  const sp = await searchParams;
  const session = (await getSession())!;
  const { t } = await getT();
  // The server clock, handed to the client so "last seen" cannot be thrown off
  // by a device whose own clock is wrong.
  const serverNow = new Date().toISOString();

  const rideLabels = {
    notRunning: t("transport.notRunning"), signalLost: t("transport.signalLost"),
    arrivingIn: t("transport.arrivingIn"), min: t("transport.min"),
    passedYourStop: t("transport.passedYourStop"), stopAway: t("transport.stopAway"),
    stopsAway: t("transport.stopsAway"), onRoute: t("transport.onRoute"),
    yourStop: t("transport.yourStop"), scheduled: t("transport.scheduled"),
    conductor: t("transport.conductor"), driver: t("transport.driver"), crew: t("transport.crew"),
    lastSeen: t("transport.lastSeen"), minAgo: t("transport.minAgo"),
    estimateNote: t("transport.estimateNote"), routeStops: t("transport.routeStops"),
    nextStop: t("transport.nextStop"), stopsRemaining: t("transport.stopsRemaining"),
    updated: t("transport.updated"), notStarted: t("transport.notStarted"),
    // Kept as the raw "{n}s ago" template: the tracker fills n in every second.
    secondsAgo: t("transport.secondsAgo"),
  };

  // ---- Crew: their own bus lives on the conductor screen ----
  // A narrow column even on a monitor — the crew screen is a phone screen, and
  // this page is only the door to it.
  if (session.effectiveRole === "transport") {
    const ctx = await getCrewContext();
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t("transport.title")} description={ctx ? `${ctx.busCode} · ${ctx.routeName}` : undefined} />
        {ctx ? (
          <Card>
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="t-h3 text-ink-900">{ctx.routeCode} {ctx.routeName}</div>
                <div className="mt-0.5 text-[13px] text-ink-500">
                  {t("transport.bus")} {ctx.busCode}
                  {ctx.registration && ` · ${ctx.registration}`}
                </div>
              </div>
              <Link prefetch={false} href="/dashboard/transport/conductor" className="inline-flex h-12 shrink-0 items-center justify-center rounded-sm bg-gold-500 px-5 text-[15px] font-medium text-ink-900 hover:bg-gold-700 hover:text-gold-100">
                {t("transport.openConsole")}
              </Link>
            </CardBody>
          </Card>
        ) : (
          <EmptyState art="no-bus-assigned" title={t("transport.noBusAssigned")} hint={t("transport.noBusAssignedHint")} />
        )}
      </div>
    );
  }

  // ---- Families: the bus their own child rides ----
  if (session.role === "student" || session.role === "guardian") {
    const rides = await getMyRides();
    // Siblings switch the whole tracker rather than stacking two maps, the same
    // way attendance switches child.
    const wanted = numParam(sp.child);
    const ride = rides.find((r) => r.studentId === wanted) ?? rides[0];
    return (
      <div>
        <PageHeader title={t("transport.title")} description={t("transport.familyIntro")} />
        {!ride ? (
          <EmptyState art="no-bus" title={t("transport.noTransport")} hint={t("transport.noTransportHint")} />
        ) : (
          <>
            {rides.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {rides.map((r) => (
                  <Link prefetch={false}
                    key={r.studentId}
                    href={`/dashboard/transport?child=${r.studentId}`}
                    className={`rounded-sm border px-3 py-1.5 text-[13px] font-medium ${r.studentId === ride.studentId ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold" : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]"}`}
                  >
                    {r.studentName}
                  </Link>
                ))}
              </div>
            )}
            <RideTracker key={ride.studentId} ride={ride} labels={rideLabels} serverNow={serverNow} />
          </>
        )}
      </div>
    );
  }

  // ---- Office, principal and teaching staff: the fleet ----
  // The board's own tiles can only count the rows it was handed; the summary is
  // the year's real fleet, so the server number wins where there is one.
  //
  // Teaching staff are NOT office: RLS gives them no bus_live rows at all, so a
  // fleet board would confidently report every bus as "Not running" and the
  // tiles as "0 / 4" while buses were on the road. Saying nothing is honest;
  // saying zero is not.
  if (!session.isAdminScope) {
    return (
      <div>
        <PageHeader title={t("transport.title")} />
        <EmptyState art="no-access" title={t("transport.staffNoLive")} hint={t("transport.staffNoLiveHint")} />
      </div>
    );
  }

  const [rows, summary] = await Promise.all([getFleet(), getFleetSummary()]);
  return (
    <div>
      <PageHeader
        title={t("transport.title")}
        description={t("transport.fleetIntro")}
        // Allotting riders is office work, and the sidebar is the only other way in.
        actions={session.isAdminScope ? (
          <Link prefetch={false}
            href="/dashboard/transport/riders"
            className="inline-flex h-9 items-center rounded-sm border border-hair bg-surface px-3 text-[13px] font-medium text-ink-900 hover:bg-panel"
          >
            {t("transport.riderAdmin")}
          </Link>
        ) : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState art="no-bus" title={t("transport.noBuses")} />
      ) : (
        <FleetBoard rows={rows} summary={summary} />
      )}
    </div>
  );
}
