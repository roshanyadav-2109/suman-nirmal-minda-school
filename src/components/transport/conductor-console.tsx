"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import type { CrewContext } from "@/lib/data/transport";

// The conductor's screen. Everything about it assumes a cheap phone, one hand,
// and a moving bus: three decisions on screen, thumb-sized targets, and an
// honest status strip so the conductor can see the school is receiving them.
//
// From md up the same screen is opened by the office on a monitor, so the
// controls and the stop list sit side by side rather than stretching one narrow
// column down a tall page. Nothing about the behaviour changes with the width.
//
// Positions are queued in memory and flushed in batches. A dead zone must not
// lose the trail, and a phone that reconnects tomorrow must not be able to
// rewrite yesterday — the database enforces the second part (see 0024).

type Shift = "morning" | "afternoon";
type Queued = { lat: number; lng: number; speed_kmh: number | null; heading: number | null; accuracy_m: number | null; battery_pct: number | null; device_at: string };

const QUEUE_CAP = 2000;
const FLUSH_MS = 10_000;
// Past this, a running trip is not reaching the school and the conductor must
// be told plainly rather than left reading a number that only creeps upward.
const SILENT_S = 60;

export function ConductorConsole({ ctx, labels }: { ctx: CrewContext; labels: Record<string, string> }) {
  const supabase = createClient();
  const [tripId, setTripId] = useState<number | null>(ctx.openTrip?.id ?? null);
  const [shift, setShift] = useState<Shift>(ctx.openTrip?.shift ?? (new Date().getHours() < 12 ? "morning" : "afternoon"));
  const [arrived, setArrived] = useState<number[]>(ctx.arrivedStopIds);
  const [fix, setFix] = useState<{ lat: number; lng: number; acc: number | null } | null>(null);
  const [queued, setQueued] = useState(0);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "Seconds since the last send" is only honest if it counts up on its own.
  const [now, setNow] = useState(() => Date.now());
  // When this trip started sending. Silence only means something measured from
  // here — a freshly opened console has sent nothing yet, and that is normal.
  const [startedAt, setStartedAt] = useState<number | null>(
    ctx.openTrip ? new Date(ctx.openTrip.started_at).getTime() : null);

  const queue = useRef<Queued[]>([]);
  // A flush in flight owns the head of the queue. Without this the interval fires
  // again mid-insert, both calls slice the same 200 rows, and the trail is
  // duplicated and truncated at the same time.
  const flushing = useRef(false);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const running = tripId != null;
  const stops = shift === "morning" ? ctx.stops : [...ctx.stops].reverse();
  const nextStop = stops.find((s) => !arrived.includes(s.id)) ?? null;
  const doneCount = stops.filter((s) => arrived.includes(s.id)).length;

  // --- flush -----------------------------------------------------------------
  // Resolves true only if the queue is now empty. `drain` keeps sending until it
  // is (End trip needs that); the interval sends one batch and comes back.
  const flush = useCallback(async (drain = false): Promise<boolean> => {
    if (!tripId || flushing.current) return queue.current.length === 0;
    flushing.current = true;
    try {
      while (queue.current.length > 0) {
        const batch = queue.current.slice(0, 200);
        const { error } = await supabase
          .from("trip_ping")
          .insert(batch.map((p) => ({ ...p, trip_id: tripId })));
        // Keep the batch on failure — a dead zone must cost time, never data.
        if (error) { setErr(error.message); return false; }
        queue.current = queue.current.slice(batch.length);
        setQueued(queue.current.length);
        setLastSent(new Date());
        setErr(null);
        if (!drain) break;
      }
      return queue.current.length === 0;
    } finally {
      flushing.current = false;
    }
  }, [supabase, tripId]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { void flush(); }, FLUSH_MS);
    return () => clearInterval(id);
  }, [running, flush]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // --- location + wake lock ---------------------------------------------------
  useEffect(() => {
    if (!running) return;
    if (!("geolocation" in navigator)) { setErr(labels.noGps); return; }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        setFix({ lat: c.latitude, lng: c.longitude, acc: c.accuracy ?? null });
        if (queue.current.length >= QUEUE_CAP) queue.current.shift();
        queue.current.push({
          lat: c.latitude, lng: c.longitude,
          speed_kmh: c.speed != null ? Number((c.speed * 3.6).toFixed(1)) : null,
          heading: c.heading != null && !Number.isNaN(c.heading) ? Math.round(c.heading) : null,
          accuracy_m: c.accuracy != null ? Math.round(c.accuracy) : null,
          battery_pct: null,
          device_at: new Date().toISOString(),
        });
        setQueued(queue.current.length);
      },
      (e) => setErr(e.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    // Screens sleep; a sleeping screen stops the GPS. This is the mitigation,
    // not a cure — the banner tells the conductor to keep the phone awake.
    const lock = async () => {
      try { wakeLock.current = await navigator.wakeLock?.request("screen"); } catch { /* not fatal */ }
    };
    lock();
    const onVisible = () => { if (document.visibilityState === "visible") lock(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [running, labels.noGps]);

  // --- actions ----------------------------------------------------------------
  async function startTrip() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase
      .from("trip")
      .insert({ bus_assignment_id: ctx.assignmentId, shift })
      .select("id")
      .single();
    setBusy(false);
    // A trip for this bus, date and shift already exists: adopt it rather than
    // failing. Double-tapping Start must never be a problem.
    if (error) {
      // (bus_assignment, service_date, shift) is unique, so a clash means today's
      // trip already exists. Adopt it whatever state it is in: already running (a
      // double tap), or ended by mistake and now being resumed.
      const { data: existing } = await supabase
        .from("trip").select("id, status")
        .eq("bus_assignment_id", ctx.assignmentId).eq("shift", shift)
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) {
        if (existing.status !== "running") {
          const { error: reopen } = await supabase
            .from("trip").update({ status: "running", ended_at: null }).eq("id", existing.id);
          if (reopen) { setErr(reopen.message); return; }
        }
        setTripId(existing.id);
        setStartedAt(Date.now());
        return;
      }
      setErr(error.message); return;
    }
    setTripId(data.id);
    setStartedAt(Date.now());
  }

  async function endTrip() {
    if (!tripId) return;
    setBusy(true);
    // Send everything still queued, not just the first batch, and refuse to end
    // the trip while any of it is unsent — this used to throw the tail of the
    // route away on a bad connection.
    const drained = await flush(true);
    if (!drained) {
      setBusy(false);
      setErr(labels.endBlocked);
      return;
    }
    const { error } = await supabase.from("trip").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", tripId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setTripId(null); setArrived([]); setQueued(0); setLastSent(null); setStartedAt(null);
  }

  async function markArrived(stopId: number) {
    if (!tripId) return;
    const had = arrived.includes(stopId);
    setArrived((a) => (a.includes(stopId) ? a : [...a, stopId]));
    const { error } = await supabase.from("trip_stop_event")
      .insert({ trip_id: tripId, route_stop_id: stopId, event: "arrived", is_manual: true });
    // A duplicate means the geofence already recorded this arrival — success.
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      // Put the button back: on a bad connection the tap must be retryable.
      if (!had) setArrived((a) => a.filter((x) => x !== stopId));
      setErr(error.message);
    }
  }

  // --- status ------------------------------------------------------------------
  const sentAgo = lastSent ? Math.max(0, Math.round((now - lastSent.getTime()) / 1000)) : null;
  const secondsAgo = (n: number) => labels.secondsAgo.replaceAll("{n}", String(n));

  // Colour is the whole point of the strip: green only when the school really
  // is hearing this bus, amber while it is drifting, red once it has stopped.
  const gpsTone = !fix ? "text-ink-500" : fix.acc == null || fix.acc <= 50 ? "text-up" : fix.acc <= 150 ? "text-watch" : "text-down";
  const queueTone = queued === 0 ? "text-ink-900" : queued < 300 ? "text-watch" : "text-down";
  // Seconds since this console last proved it was heard: a successful send, or
  // failing that the moment the trip started.
  const quietFor = !running
    ? null
    : Math.max(0, Math.round((now - (lastSent?.getTime() ?? startedAt ?? now)) / 1000));
  const sentTone = !running ? "text-ink-500"
    : quietFor == null || quietFor > SILENT_S ? "text-down"
    : quietFor > 30 ? "text-watch" : "text-up";
  const silent = running && quietFor != null && quietFor > SILENT_S;

  return (
    <div className="space-y-4 md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start md:gap-4 md:space-y-0">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="t-label">{ctx.routeCode} · {ctx.routeName}</div>
              <div className="text-[20px] font-bold text-ink-900">{ctx.busCode}</div>
            </div>
            <div className="text-right text-[12px] text-ink-500">{ctx.registration}</div>
          </div>

          {!running && (
            <div className="flex gap-2">
              {(["morning", "afternoon"] as Shift[]).map((s) => (
                <button key={s} onClick={() => setShift(s)}
                  className={`flex-1 rounded-sm border px-3 py-2 text-[13px] font-medium ${s === shift ? "border-gold-500 bg-gold-100 text-ink-900" : "border-hair bg-surface text-ink-500"}`}>
                  {labels[s]}
                </button>
              ))}
            </div>
          )}

          {running ? (
            <Button variant="danger" className="h-14 w-full text-[16px]" disabled={busy} onClick={endTrip}>
              {labels.endTrip}
            </Button>
          ) : (
            <Button variant="gold" className="h-14 w-full text-[16px]" disabled={busy} onClick={startTrip}>
              {labels.startTrip}
            </Button>
          )}

          {running && (
            <div className="rounded-sm bg-panel px-3 py-2 text-[12px] text-ink-500">
              {labels.keepAwake}
            </div>
          )}

          <div>
            <div className="text-[12px] text-ink-500">
              {labels.stopsDone.replace("{done}", String(doneCount)).replace("{total}", String(stops.length))}
            </div>
            <div className="mt-1.5 h-1 w-full rounded-sm bg-panel">
              <div className="h-1 rounded-sm bg-gold-500"
                style={{ width: `${stops.length ? (doneCount / stops.length) * 100 : 0}%` }} />
            </div>
            {nextStop && (
              <div className="mt-1.5 truncate text-[12px] text-ink-500">
                {labels.nextStop}: <span className="text-ink-900">{nextStop.name}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-sm border border-hair px-2 py-1.5">
              <div className="t-label">{labels.gps}</div>
              <div className={`tabular font-semibold ${gpsTone}`}>
                {fix ? (fix.acc != null ? `±${Math.round(fix.acc)} m` : labels.ok) : "—"}
              </div>
            </div>
            <div className="rounded-sm border border-hair px-2 py-1.5">
              <div className="t-label">{labels.queued}</div>
              <div className={`tabular font-semibold ${queueTone}`}>{queued}</div>
            </div>
            <div className="rounded-sm border border-hair px-2 py-1.5">
              <div className="t-label">{labels.lastSent}</div>
              <div className={`tabular font-semibold ${sentTone}`}>{sentAgo == null ? "—" : secondsAgo(sentAgo)}</div>
            </div>
          </div>

          {silent && (
            <div className="rounded-sm border border-hair bg-panel px-3 py-2 text-[12px] font-medium text-down">
              {labels.notSending}
              {sentAgo != null && ` · ${labels.lastSent} ${secondsAgo(sentAgo)}`}
            </div>
          )}

          {err && <div className="rounded-sm border border-hair bg-panel px-3 py-2 text-[12px] text-down">{err}</div>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <ul className="divide-y divide-hair">
            {stops.map((s) => {
              const done = arrived.includes(s.id);
              const isNext = nextStop?.id === s.id;
              const riders = ctx.riderCountByStop[s.id] ?? 0;
              return (
                <li key={s.id} className={`flex items-center gap-3 py-3 pr-4 ${isNext ? "border-l-4 border-gold-500 bg-gold-100 pl-3" : "pl-4"}`}>
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? "bg-up" : isNext ? "bg-gold-500" : "bg-hair"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate ${isNext ? "text-[16px] font-bold" : "text-[14px]"} ${done ? "text-ink-500 line-through" : "font-medium text-ink-900"}`}>
                      {s.name}
                      {isNext && (
                        <span className="ml-2 rounded-sm bg-gold-500 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-ink-900">
                          {labels.next}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-500">
                      {(shift === "morning" ? s.sched_am : s.sched_pm)?.slice(0, 5) ?? "—"}
                      {riders > 0 && ` · ${riders} ${labels.riders}`}
                    </div>
                  </div>
                  {running && !done && (
                    <Button variant="subtle" className="h-12 min-w-[5.5rem] px-4 text-[15px]" onClick={() => markArrived(s.id)}>{labels.arrived}</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
