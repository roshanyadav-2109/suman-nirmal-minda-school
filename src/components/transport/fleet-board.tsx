"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/provider";
import { Card, CardBody } from "@/components/ui/card";
import type { FleetRow, FleetSummary, Live } from "@/lib/data/transport";
import { LOST_S, POLL_MS } from "@/components/transport/thresholds";

const LiveMap = dynamic(() => import("@/components/transport/live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[280px] w-full animate-pulse rounded-md bg-panel" />,
});

// The office wall board: three numbers, every bus on one map, and a table that
// answers the only question a school asks in the morning — which bus is late,
// and which one has stopped reporting. Problems sort to the top so nobody has
// to read the whole fleet to find the one that needs a phone call.

type State = "lost" | "live" | "idle";
// Signal lost first, then running, then idle: the board is read top-down.
const STATE_ORDER: Record<State, number> = { lost: 0, live: 1, idle: 2 };

export function FleetBoard({
  rows,
  summary,
}: {
  rows: FleetRow[];
  /** Server-side counts when the page has them; otherwise derived from `rows`. */
  summary?: FleetSummary;
}) {
  const t = useT();
  const supabase = useMemo(() => createClient(), []);
  const [live, setLive] = useState<Record<number, Live>>(() =>
    Object.fromEntries(rows.filter((r) => r.live).map((r) => [r.busId, r.live as Live])));
  const [now, setNow] = useState(() => Date.now());
  const [focusBusId, setFocusBusId] = useState<number | null>(null);

  // "Last heard 12s ago" has to count up on its own, so the clock ticks even
  // when no new position arrives.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("fleet-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bus_live" },
        (payload) => {
          const row = payload.new as Live;
          setLive((m) => ({ ...m, [row.bus_id]: row }));
        })
      .subscribe();

    const pull = async () => {
      const { data } = await supabase.from("bus_live").select("*");
      if (data) setLive(Object.fromEntries((data as Live[]).map((l) => [l.bus_id, l])));
    };

    // A background tab gets no socket messages either, so polling stops with it
    // and the first thing a returning tab does is catch up in one shot.
    let poll: ReturnType<typeof setInterval> | null = null;
    const start = () => { poll ??= setInterval(() => void pull(), POLL_MS); };
    const stop = () => { if (poll) { clearInterval(poll); poll = null; } };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { void pull(); start(); setNow(Date.now()); }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const focusRow = focusBusId == null ? null : rows.find((r) => r.busId === focusBusId) ?? null;

  // Focusing narrows the stops to the picked bus's route so the map is not a
  // hairball of every route at once; LiveMap's focusBusId then centres the
  // camera on the vehicle itself.
  const mapStops = useMemo(
    () => (focusRow ? [focusRow] : rows).flatMap((r) =>
      r.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }))),
    [rows, focusRow],
  );

  // Marker colour only changes at the five-minute line, so the map is fed a
  // coarse clock: a per-second one would redraw every bus icon every second.
  const coarseNow = Math.floor(now / 30000) * 30000;
  const mapBuses = useMemo(
    () => rows
      .map((r) => ({ r, l: live[r.busId] }))
      .filter((x) => x.l?.lat != null)
      .map(({ r, l }) => ({
        busId: r.busId,
        code: r.busCode,
        lat: l.lat,
        lng: l.lng,
        heading: l.heading,
        isRunning: l.is_running,
        staleSeconds: Math.round((coarseNow - new Date(l.updated_at).getTime()) / 1000),
      })),
    [rows, live, coarseNow],
  );

  const board = useMemo(() => {
    const at = (r: FleetRow) => {
      const l = live[r.busId] ?? null;
      const age = l ? Math.max(0, Math.round((now - new Date(l.updated_at).getTime()) / 1000)) : null;
      const state: State = !l?.is_running ? "idle" : age != null && age > LOST_S ? "lost" : "live";
      return { row: r, l, age, state };
    };
    return rows.map(at).sort((a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.row.busCode.localeCompare(b.row.busCode));
  }, [rows, live, now]);

  const tiles = useMemo(() => {
    // Riders are counted per route, so two buses on one route must not add up
    // twice. This is the only number that cannot move during a shift, so the
    // server's count is preferred for it.
    const perRoute = new Map(rows.map((r) => [r.routeId, r.riders]));
    return {
      buses: rows.length,
      // Derived from live state, never from the server snapshot: a tile that
      // disagrees with the row under it is worse than no tile at all.
      running: board.filter((b) => b.state === "live").length,
      riders: summary ? summary.riders : [...perRoute.values()].reduce((a, n) => a + n, 0),
      stale: board.filter((b) => b.state === "lost").length,
    } satisfies FleetSummary;
  }, [summary, rows, board]);

  const lastHeard = (state: State, age: number | null) => {
    if (state === "idle") return <span className="text-ink-500">{t("transport.notRunning")}</span>;
    if (state === "lost") return <span className="font-medium text-down">{t("transport.signalLost")}</span>;
    if (age == null) return <span className="text-ink-500">—</span>;
    return (
      <span className="tabular text-up">
        {age < 60 ? t("transport.secondsAgo", { n: age }) : `${Math.round(age / 60)} ${t("transport.minAgo")}`}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("transport.busesRunning")} value={`${tiles.running} / ${tiles.buses}`} />
        <Tile label={t("transport.totalRiders")} value={tiles.riders} />
        <Tile
          label={t("transport.staleBuses")}
          value={tiles.stale}
          hint={t("transport.staleBusesHint")}
          alarm={tiles.stale > 0}
        />
      </div>

      <div className="grid gap-4">
        <div className="h-[380px] xl:h-[46vh] xl:min-h-[360px]">
          <LiveMap
            stops={mapStops}
            buses={mapBuses}
            focusBusId={focusBusId}
            nextStopId={focusRow ? live[focusRow.busId]?.next_stop_id ?? null : null}
          />
        </div>

        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          <CardBody className="flex min-h-0 flex-col p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-hair px-4 py-3">
              <div className="t-label">{t("transport.fleet")}</div>
              <div className="text-[12px] text-ink-500">
                <span className="tabular">{tiles.running}</span> / <span className="tabular">{tiles.buses}</span>{" "}
                {t("transport.running")}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead className="sticky top-0 z-10 bg-panel">
                  <tr className="border-b border-hair text-left text-ink-500">
                    <th className="px-4 py-2 font-medium">{t("transport.bus")}</th>
                    <th className="px-3 py-2 font-medium">{t("transport.route")}</th>
                    <th className="px-3 py-2 font-medium">{t("transport.crew")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("transport.riders")}</th>
                    <th className="px-3 py-2 font-medium">{t("transport.nextStop")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("transport.eta")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("transport.lastHeard")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  {board.map(({ row: r, l, age, state }) => {
                    const focused = r.busId === focusBusId;
                    const nextName = state === "live" ? r.stops.find((s) => s.id === l?.next_stop_id)?.name ?? "—" : "—";
                    const eta = state === "live" && l?.eta_seconds != null
                      ? `${Math.max(1, Math.round(l.eta_seconds / 60))} ${t("transport.min")}`
                      : "—";
                    return (
                      <tr
                        key={r.assignmentId}
                        tabIndex={0}
                        aria-selected={focused}
                        onClick={() => setFocusBusId(focused ? null : r.busId)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          setFocusBusId(focused ? null : r.busId);
                        }}
                        className={`cursor-pointer border-l-2 outline-none hover:bg-panel focus-visible:bg-panel ${
                          focused ? "bg-gold-100 border-l-gold-500" : "border-l-transparent"
                        }`}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 shrink-0 rounded-sm ${
                                state === "lost" ? "bg-down" : state === "live" ? "bg-up" : "bg-hair"
                              }`}
                            />
                            <span className="font-medium text-ink-900">{r.busCode}</span>
                          </div>
                          <div className="pl-3.5 text-[11px] text-ink-500">{r.registration}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-ink-900">{r.routeCode}</div>
                          <div className="text-[11px] text-ink-500">{r.routeName}</div>
                        </td>
                        <td className="px-3 py-2 text-ink-500">
                          <div>{r.conductor ?? "—"}</div>
                          <div className="text-[11px]">{r.driver ?? ""}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular text-ink-900">{r.riders}</td>
                        <td className="px-3 py-2">
                          <span className={state === "live" ? "text-ink-900" : "text-ink-500"}>{nextName}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular text-ink-500">{eta}</td>
                        <td className="px-4 py-2 text-right">{lastHeard(state, age)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  alarm = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  alarm?: boolean;
}) {
  return (
    <Card className={alarm ? "border-gold-500" : undefined}>
      <CardBody>
        <div className="t-label">{label}</div>
        <div className={`t-h1 mt-1 tabular ${alarm ? "text-down" : "text-ink-900"}`}>{value}</div>
        {hint && <div className="mt-1 text-[12px] text-ink-500">{hint}</div>}
      </CardBody>
    </Card>
  );
}
