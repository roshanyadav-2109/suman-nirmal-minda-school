"use client";
import { useEffect, useRef } from "react";
import type { Map as LMap, Marker, Polyline, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LOST_S } from "@/components/transport/thresholds";

// Leaflet talks to the DOM directly, so it is driven from an effect rather than
// wrapped in a React component tree. Markers are DivIcons — Leaflet's default
// PNG markers break under a bundler, and this way the bus takes the KV palette.

// A default parameter would be a new array on every render, and the stops
// effect (which refits the bounds) depends on that identity.
const NO_ARRIVED: number[] = [];

export type MapStop = { id: number; name: string; lat: number; lng: number };
export type MapBus = {
  busId: number;
  code: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  isRunning: boolean;
  staleSeconds: number | null;
};

const busIcon = (code: string, heading: number | null, stale: boolean) => `
  <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
    <div style="background:${stale ? "rgb(140,140,140)" : "rgb(20,20,20)"};color:#fff;font:600 11px/1 Inter,system-ui,sans-serif;
                padding:4px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)">${code}</div>
    <div style="width:0;height:0;border:5px solid transparent;border-top-color:${stale ? "rgb(140,140,140)" : "rgb(20,20,20)"}"></div>
    <div style="width:14px;height:14px;border-radius:50%;background:${stale ? "rgb(160,160,160)" : "rgb(198,157,58)"};
                border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
                transform:rotate(${heading ?? 0}deg)"></div>
  </div>`;

const stopIcon = (label: string, state: "done" | "next" | "todo") => {
  const fill = state === "done" ? "rgb(46,125,80)" : state === "next" ? "rgb(198,157,58)" : "#fff";
  const ring = state === "todo" ? "rgb(180,180,180)" : fill;
  return `
  <div style="display:flex;align-items:center;gap:5px">
    <div style="width:11px;height:11px;border-radius:50%;background:${fill};border:2px solid ${ring};box-shadow:0 0 0 2px #fff"></div>
    <div style="font:500 11px/1 Inter,system-ui,sans-serif;color:rgb(60,60,60);background:rgba(255,255,255,.82);
                padding:2px 4px;border-radius:3px;white-space:nowrap">${label}</div>
  </div>`;
};

export function LiveMap({
  stops,
  buses,
  arrivedStopIds = NO_ARRIVED,
  nextStopId = null,
  focusBusId = null,
  className = "",
}: {
  stops: MapStop[];
  buses: MapBus[];
  arrivedStopIds?: number[];
  nextStopId?: number | null;
  /** Centre on this bus's own position instead of fitting the route's bounds. */
  focusBusId?: number | null;
  className?: string;
}) {
  // Picking a bus follows it: the camera stays on the vehicle as it moves,
  // rather than on the route it happens to be somewhere along. A bus with no
  // position yet cannot be centred on, so the route's bounds still win there.
  const focused = focusBusId == null ? null : buses.find((b) => b.busId === focusBusId) ?? null;
  const focusLat = focused?.lat ?? null;
  const focusLng = focused?.lng ?? null;
  const hasFocusPoint = focusLat != null && focusLng != null;

  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LMap | null>(null);
  const busLayer = useRef<LayerGroup | null>(null);
  const stopLayer = useRef<LayerGroup | null>(null);
  const line = useRef<Polyline | null>(null);
  const markers = useRef<Record<number, Marker>>({});

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current || map.current) return;
      const m = L.map(holder.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      stopLayer.current = L.layerGroup().addTo(m);
      busLayer.current = L.layerGroup().addTo(m);
      map.current = m;
      m.setView([23.0466, 72.5], 12);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Route line + stops.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !stopLayer.current) return;
      stopLayer.current.clearLayers();
      line.current?.remove();
      if (!stops.length) return;

      const pts = stops.map((s) => [s.lat, s.lng] as [number, number]);
      line.current = L.polyline(pts, { color: "rgb(198,157,58)", weight: 3, opacity: 0.65 }).addTo(map.current);

      stops.forEach((s) => {
        const state = arrivedStopIds.includes(s.id) ? "done" : s.id === nextStopId ? "next" : "todo";
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({ html: stopIcon(s.name, state), className: "", iconSize: [0, 0] }),
        }).addTo(stopLayer.current!);
      });

      // The focus effect owns the camera whenever it has a vehicle to point at;
      // refitting the route here would yank the view straight back off it.
      if (!hasFocusPoint) map.current.fitBounds(L.latLngBounds(pts).pad(0.18));
    })();
    return () => { cancelled = true; };
  }, [stops, arrivedStopIds, nextStopId, hasFocusPoint]);

  // Bus markers move without redrawing the map.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !busLayer.current) return;
      const seen = new Set<number>();
      for (const b of buses) {
        if (b.lat == null || b.lng == null) continue;
        seen.add(b.busId);
        const stale = !b.isRunning || (b.staleSeconds ?? 0) > LOST_S;
        const icon = L.divIcon({ html: busIcon(b.code, b.heading, stale), className: "", iconSize: [0, 0] });
        const existing = markers.current[b.busId];
        if (existing) { existing.setLatLng([b.lat, b.lng]); existing.setIcon(icon); }
        else markers.current[b.busId] = L.marker([b.lat, b.lng], { icon, zIndexOffset: 500 }).addTo(busLayer.current!);
      }
      for (const idStr of Object.keys(markers.current)) {
        const id = Number(idStr);
        if (!seen.has(id)) { markers.current[id].remove(); delete markers.current[id]; }
      }
    })();
    return () => { cancelled = true; };
  }, [buses]);

  useEffect(() => {
    if (!map.current || focusLat == null || focusLng == null) return;
    map.current.setView([focusLat, focusLng], Math.max(map.current.getZoom(), 15), { animate: true });
  }, [focusBusId, focusLat, focusLng]);

  return <div ref={holder} className={`h-full w-full rounded-md ${className}`} style={{ minHeight: 280, zIndex: 0 }} />;
}
