"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody } from "@/components/ui/card";
import { BusIcon, ArrowRightIcon } from "@/components/icons";
import type { RideSummary } from "@/lib/data/transport";
import { LOST_MS, POLL_MS, serverSkewMs } from "@/components/transport/thresholds";

// The dashboard version of the ride tracker: one line of truth per child, no
// map. It obeys the same two rules as the full tracker — never show a stale
// position as if it were live, never dress an estimate up as a promise.

export type TransportCardLabels = {
  trackBus: string;
  notStarted: string;
  signalLost: string;
  arrivingIn: string;
  atStop: string;
  onTheWay: string;
  stopsRemaining: string;
  runFinished: string;
  nextStop: string;
  passedYourStop: string;
  min: string;
  minAgo: string;
  liveNow: string;
  lastSeen: string;
  yourStop: string;
  scheduled: string;
};

type LiveBits = {
  isRunning: boolean;
  nextStopId: number | null;
  nextStopName: string | null;
  etaSeconds: number | null;
  stopsRemaining: number | null;
  updatedAt: string | null;
};

export function TransportCard({
  ride,
  labels,
  title,
  serverNow,
}: {
  ride: RideSummary;
  labels: TransportCardLabels;
  /** The server clock at render, so freshness ignores a wrong device clock. */
  serverNow?: string;
  /** Whose bus this is — only worth printing when a guardian has siblings. */
  title?: string;
}) {
  // One client for the life of the card: both the channel and the poll are torn
  // down by bus id, so a fresh client per render would leak sockets.
  const supabase = useMemo(() => createClient(), []);
  const busId = ride.busId;
  const [live, setLive] = useState<LiveBits>({
    isRunning: ride.isRunning,
    nextStopId: ride.nextStopId,
    nextStopName: ride.nextStopName,
    etaSeconds: ride.etaSeconds,
    stopsRemaining: ride.stopsRemaining,
    updatedAt: ride.updatedAt,
  });
  const [now, setNow] = useState(() => Date.now());
  const [skew] = useState(() => serverSkewMs(serverNow));

  const pull = useCallback(async () => {
    if (busId == null) return;
    const { data } = await supabase
      .from("bus_live")
      .select("is_running, next_stop_id, eta_seconds, stops_remaining, updated_at, next_stop:next_stop_id(name)")
      .eq("bus_id", busId)
      .maybeSingle();
    if (!data) return;
    setLive({
      isRunning: data.is_running,
      nextStopId: data.next_stop_id,
      nextStopName: (data.next_stop as unknown as { name: string } | null)?.name ?? null,
      etaSeconds: data.eta_seconds,
      stopsRemaining: data.stops_remaining,
      updatedAt: data.updated_at,
    });
    setNow(Date.now());
  }, [supabase, busId]);

  // Realtime for the common case, a 5s poll as the fallback, and both idle
  // while the tab is hidden — a dashboard left open all day must not hammer the
  // database or a parent's phone battery.
  useEffect(() => {
    if (busId == null) return;
    const channel = supabase
      .channel(`transport-card-${busId}-${ride.studentId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bus_live", filter: `bus_id=eq.${busId}` },
        () => { if (!document.hidden) void pull(); })
      .subscribe();

    const timer = setInterval(() => {
      if (document.hidden) return;
      setNow(Date.now()); // keeps "last seen 2 min ago" honest between fetches
      void pull();
    }, POLL_MS);

    // Coming back to the tab, the numbers on screen are as old as the absence.
    const onVisible = () => { if (!document.hidden) void pull(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, busId, ride.studentId, pull]);

  // updatedAt is the server clock; now is the device clock. Align them before
  // judging freshness, or a phone that is a few minutes fast calls a healthy
  // bus lost.
  const ageMs = live.updatedAt ? Math.max(0, now + skew - new Date(live.updatedAt).getTime()) : null;
  const lost = live.isRunning && ageMs != null && ageMs > LOST_MS;

  // Is the bus heading for THIS pupil's stop? Only then is bus_live's ETA an
  // answer to "when does my child's bus get here".
  const etaIsMine = live.nextStopId != null && live.nextStopId === ride.stopId;
  // Once the bus is past their stop it has no ETA left to offer them at all.
  const passed = live.isRunning && live.nextStopId != null && !etaIsMine && live.stopsRemaining != null;

  let text = labels.onTheWay;
  let tone = "text-ink-500";
  if (!live.isRunning) {
    // A bus that reported today and has since stopped has FINISHED. Saying "not
    // started" tells a parent the opposite of what actually happened, for most
    // of the day.
    const reportedToday =
      live.updatedAt != null &&
      new Date(live.updatedAt).toDateString() === new Date(now + skew).toDateString();
    text = reportedToday ? labels.runFinished : labels.notStarted;
  } else if (lost) {
    text = labels.signalLost;
    tone = "text-down";
  } else if (etaIsMine && live.etaSeconds != null && live.etaSeconds <= 60) {
    text = labels.atStop;
    tone = "text-up";
  } else if (etaIsMine && live.etaSeconds != null) {
    text = `${labels.arrivingIn} ~${Math.round(live.etaSeconds / 60)} ${labels.min}`;
    tone = "text-up";
  } else if (passed) {
    text = labels.onTheWay;
    tone = "text-watch";
  }

  const ageMin = ageMs != null ? Math.round(ageMs / 60000) : null;
  const fresh = live.isRunning && !lost;

  return (
    <Card>
      <CardBody className="p-4">
        {title && <div className="t-label mb-1.5 truncate">{title}</div>}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BusIcon size={18} className="shrink-0 text-ink-900" />
              <span className="truncate text-[14px] font-semibold text-ink-900">{ride.busCode}</span>
              <span className="truncate text-[12px] text-ink-500">{ride.routeCode} {ride.routeName}</span>
            </div>
            <div className={`mt-1.5 text-[18px] font-semibold leading-tight ${tone}`}>{text}</div>
            <div className="mt-1 truncate text-[12px] text-ink-500">
              {labels.yourStop}: {ride.stopName || "—"}
              {ride.schedAm && ` · ${labels.scheduled} ${ride.schedAm.slice(0, 5)}`}
            </div>
            {live.isRunning && !lost && !etaIsMine && live.nextStopName && (
              <div className="mt-0.5 truncate text-[12px] text-ink-500">
                {labels.nextStop}: {live.nextStopName}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right text-[11px] text-ink-500">
            {fresh && ageMin != null && ageMin < 1 ? (
              <span className="inline-flex items-center gap-1.5 text-up">
                <span className="h-1.5 w-1.5 rounded-full bg-up" />
                {labels.liveNow}
              </span>
            ) : ageMin != null && live.isRunning ? (
              <span>{labels.lastSeen} {Math.max(1, ageMin)} {labels.minAgo}</span>
            ) : null}
          </div>
        </div>
        <Link prefetch={false}
          href="/transport"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-normal text-[rgb(37,99,235)] hover:text-ink-900"
        >
          {labels.trackBus}
          <ArrowRightIcon size={13} />
        </Link>
      </CardBody>
    </Card>
  );
}
