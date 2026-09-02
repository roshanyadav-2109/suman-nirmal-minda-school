"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody } from "@/components/ui/card";
import type { Live, RiderView } from "@/lib/data/transport";
import { LOST_S, POLL_MS } from "@/components/transport/thresholds";

const LiveMap = dynamic(() => import("@/components/transport/live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[280px] w-full animate-pulse rounded-md bg-panel" />,
});

// What a parent sees. Two rules govern everything here:
//   1. Never show a stale position as if it were live.
//   2. Never show a precise-looking ETA. It is an estimate and says so.
// Desktop gets the map as the main object with a status rail beside it; the
// same tree stacks to one column on a phone, map first.

const STALE_S = 60;      // no fix for a minute: say when it was last seen

export function RideTracker({ ride, labels }: { ride: RiderView; labels: Record<string, string> }) {
  // One client for the life of the component: the poll and the channel are both
  // torn down by bus id, so a new client per render would leak sockets.
  const supabase = useMemo(() => createClient(), []);
  const [live, setLive] = useState<Live | null>(ride.live);
  const [arrived, setArrived] = useState<number[]>(ride.arrivedStopIds);
  const [now, setNow] = useState(() => Date.now());

  // One-second tick so the freshness read-out counts up on its own.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("bus_live").select("*").eq("bus_id", ride.busId).maybeSingle();
    if (!data) return;
    setLive(data as Live);
    if (data.trip_id) {
      const { data: ev } = await supabase.from("trip_stop_event")
        .select("route_stop_id").eq("trip_id", data.trip_id).eq("event", "arrived");
      setArrived((ev ?? []).map((e) => e.route_stop_id));
    }
  }, [supabase, ride.busId]);

  // Realtime, with polling as the fallback: a dropped socket must degrade to a
  // slower map, never to a frozen one. A backgrounded tab polls nothing — the
  // parent is not looking, and a school run lasts an hour.
  useEffect(() => {
    const channel = supabase
      .channel(`bus-live-${ride.busId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bus_live", filter: `bus_id=eq.${ride.busId}` },
        (payload) => setLive(payload.new as Live))
      .subscribe();

    let poll: ReturnType<typeof setInterval> | null = null;
    const start = () => { poll ??= setInterval(() => void refresh(), POLL_MS); };
    const stop = () => { if (poll) { clearInterval(poll); poll = null; } };

    // Coming back to the tab fetches at once: whatever the socket missed while
    // it was hidden would otherwise sit on screen for a further five seconds.
    const onVisibility = () => {
      if (document.hidden) stop();
      else { void refresh(); setNow(Date.now()); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(channel);
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [supabase, ride.busId, refresh]);

  const myStop = ride.stops.find((s) => s.id === ride.pickupStopId) ?? null;
  const ageS = live?.updated_at ? Math.round((now - new Date(live.updated_at).getTime()) / 1000) : null;
  const lost = !live?.is_running || (ageS != null && ageS > LOST_S);
  const stale = !lost && ageS != null && ageS > STALE_S;

  const status = useMemo(() => {
    if (!live?.is_running) return { tone: "flat", text: labels.notRunning };
    if (lost) return { tone: "down", text: labels.signalLost };
    if (arrived.includes(ride.pickupStopId)) return { tone: "up", text: labels.passedYourStop };
    if (live.next_stop_id === ride.pickupStopId && live.eta_seconds != null) {
      const mins = Math.max(1, Math.round(live.eta_seconds / 60));
      return { tone: "up", text: `${labels.arrivingIn} ~${mins} ${labels.min}` };
    }
    const stopsAway =
      ride.stops.findIndex((s) => s.id === ride.pickupStopId) -
      ride.stops.findIndex((s) => s.id === live.next_stop_id);
    if (stopsAway > 0) return { tone: "watch", text: `${stopsAway} ${stopsAway === 1 ? labels.stopAway : labels.stopsAway}` };
    return { tone: "flat", text: labels.onRoute };
  }, [live, lost, arrived, ride, labels]);

  const toneClass = status.tone === "up" ? "text-up" : status.tone === "down" ? "text-down" : status.tone === "watch" ? "text-watch" : "text-ink-900";

  // Freshness in words. Under a minute it is live; past that the age itself is
  // the news, so the seconds give way to whole minutes.
  const freshness = (() => {
    if (ageS == null) return { dot: "bg-hair", text: labels.notStarted, tone: "text-ink-500" };
    if (lost) return { dot: "bg-hair", text: `${labels.lastSeen} ${Math.max(1, Math.round(ageS / 60))} ${labels.minAgo}`, tone: "text-down" };
    if (stale) return { dot: "bg-watch", text: `${labels.lastSeen} ${Math.max(1, Math.round(ageS / 60))} ${labels.minAgo}`, tone: "text-watch" };
    return { dot: "bg-up", text: `${labels.updated} ${labels.secondsAgo.replace("{n}", String(Math.max(0, ageS)))}`, tone: "text-ink-500" };
  })();

  const nextStopName = ride.stops.find((s) => s.id === live?.next_stop_id)?.name ?? null;
  const schedule = [myStop?.sched_am, myStop?.sched_pm].filter(Boolean).map((v) => v!.slice(0, 5));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="overflow-hidden p-1.5 lg:sticky lg:top-4">
        <div className="h-[340px] sm:h-[420px] lg:h-[560px] xl:h-[620px]">
          <LiveMap
            stops={ride.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }))}
            arrivedStopIds={arrived}
            nextStopId={live?.next_stop_id ?? null}
            buses={live && live.lat != null ? [{
              busId: ride.busId, code: ride.busCode, lat: live.lat, lng: live.lng,
              heading: live.heading, isRunning: live.is_running, staleSeconds: ageS,
            }] : []}
          />
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="t-label truncate">{ride.busCode} · {ride.routeCode} {ride.routeName}</div>
              <div className={`flex shrink-0 items-center gap-1.5 text-[12px] tabular ${freshness.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${freshness.dot}`} />
                {freshness.text}
              </div>
            </div>

            <div className={`text-[30px] font-bold leading-[1.1] tracking-[-0.01em] xl:text-[34px] ${toneClass}`}>
              {status.text}
            </div>

            {live?.is_running && !lost && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
                {nextStopName && <span>{labels.nextStop}: <span className="text-ink-900">{nextStopName}</span></span>}
                {live.stops_remaining != null && (
                  <span className="tabular">{live.stops_remaining} {labels.stopsRemaining}</span>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div>
              <div className="t-label text-ink-500">{labels.yourStop}</div>
              <div className="mt-0.5 text-[16px] font-semibold text-ink-900">{myStop?.name ?? "—"}</div>
              {schedule.length > 0 && (
                <div className="mt-0.5 text-[13px] tabular text-ink-500">{labels.scheduled} {schedule.join(" · ")}</div>
              )}
            </div>
            {(ride.conductor || ride.driver) && (
              <div className="space-y-2 border-t border-hair pt-3">
                <div className="t-label text-ink-500">{labels.crew}</div>
                {ride.conductor && (
                  <div>
                    <div className="text-[14px] text-ink-900">{ride.conductor}</div>
                    <div className="text-[12px] text-ink-500">{labels.conductor}</div>
                  </div>
                )}
                {ride.driver && (
                  <div>
                    <div className="text-[14px] text-ink-900">{ride.driver}</div>
                    <div className="text-[12px] text-ink-500">{labels.driver}</div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="t-label text-ink-500">{labels.routeStops}</div>
            <ol className="max-h-[420px] overflow-y-auto pr-1">
              {ride.stops.map((s, i) => {
                const done = arrived.includes(s.id);
                const isNext = live?.next_stop_id === s.id;
                const mine = s.id === ride.pickupStopId;
                const last = i === ride.stops.length - 1;
                return (
                  <li key={s.id} className={`relative flex gap-3 ${last ? "" : "pb-5"}`}>
                    {/* The rail is drawn behind the ticks, and is only green as
                        far as the bus has actually got. */}
                    {!last && (
                      <span aria-hidden className={`absolute left-[5px] top-3 -bottom-1 w-px ${done ? "bg-up" : "bg-hair"}`} />
                    )}
                    <span
                      aria-hidden
                      className={`relative z-[1] mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${
                        done ? "border-up bg-up"
                          : isNext ? "border-gold-500 bg-gold-500"
                          : mine ? "border-gold-500 bg-surface"
                          : "border-hair bg-surface"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[13px] ${done ? "text-ink-500" : "text-ink-900"} ${mine ? "font-semibold" : ""}`}>
                        {s.name}
                      </div>
                      {mine && (
                        <span className="mt-1 inline-block rounded-sm bg-gold-100 px-1.5 py-0.5 text-[11px] font-medium text-gold-700">
                          {labels.yourStop}
                        </span>
                      )}
                    </div>
                    <div className="tabular text-[12px] text-ink-500">{s.sched_am?.slice(0, 5) ?? ""}</div>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>

        <p className="text-[11px] text-ink-500">{labels.estimateNote}</p>
      </div>
    </div>
  );
}
