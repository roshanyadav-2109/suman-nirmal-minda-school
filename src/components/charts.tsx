"use client";
import { useRef, useState, useEffect } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, Area, AreaChart, LabelList,
} from "recharts";
import { ArrowRightIcon } from "@/components/icons";

// Token values (Recharts needs concrete colours).
export const C = {
  ink: "#2B1B1C",
  ink500: "#6B5B57",
  muted: "#857971",
  gold: "#E09E3E",
  gold700: "#B5761B",
  gold300: "#F3DFB4",
  hair: "#E9E0D4",
  panel: "#F6F1E9",
  up: "#157D1C",
  watch: "#DB7A1C",
  down: "#C0442E",
};
// Bright, jewel-toned multi-series palette — vivid and premium.
export const SERIES = ["#2563eb", "#059669", "#7c3aed", "#db2777", "#d97706", "#0891b2", "#dc2626"];

const axis = { stroke: "#111827", tick: { fill: "#111827", fontSize: 12, fontWeight: 500 }, tickLine: false };

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-hair bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      <div className="mb-1 font-semibold text-ink-900">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-500">{p.name}</span>
          <span className="ml-auto font-semibold text-ink-900">{typeof p.value === "number" ? p.value : "—"}</span>
        </div>
      ))}
    </div>
  );
}

type LineDef = { key: string; name: string; color?: string };

// Horizontal scroll wrapper: a subtle edge fade + a chevron on the side(s)
// where more content is available; both hide once you reach that edge.
function HScroll({ minWidth, children }: { minWidth?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth]);
  if (!minWidth) return <>{children}</>;
  const scroll = (d: number) => ref.current?.scrollBy({ left: d, behavior: "smooth" });
  const btn = "absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-hair bg-surface text-ink-900 shadow-[var(--shadow-pop)]";
  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ minWidth }}>{children}</div>
      </div>
      {edge.left && (
        <button aria-label="Scroll left" onClick={() => scroll(-240)} className={`${btn} left-1 rotate-180`}><ArrowRightIcon size={15} /></button>
      )}
      {edge.right && (
        <button aria-label="Scroll right" onClick={() => scroll(240)} className={`${btn} right-1`}><ArrowRightIcon size={15} /></button>
      )}
    </div>
  );
}

export function KVLineChart({
  data, xKey, lines, height = 260, area = false, yDomain = [0, 100],
}: {
  data: Record<string, unknown>[];
  xKey: string;
  lines: LineDef[];
  height?: number;
  area?: boolean;
  yDomain?: [number, number];
}) {
  const Chart = area ? AreaChart : LineChart;
  // Reserve ~64px per label; if that exceeds the container the plot scrolls so
  // every label stays fully visible.
  const minWidth = data.length * 64;
  return (
    <HScroll minWidth={minWidth}>
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid stroke={C.hair} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...axis} interval={0} height={30} tickMargin={6} />
          <YAxis domain={yDomain} {...axis} width={40} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: "#2563eb", strokeOpacity: 0.3 }} />
          {lines.map((l, i) =>
            area ? (
              <Area key={l.key} type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color ?? SERIES[i % SERIES.length]} fill={l.color ?? SERIES[i % SERIES.length]}
                fillOpacity={0.12} strokeWidth={2.25} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
            ) : (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color ?? SERIES[i % SERIES.length]} strokeWidth={2.25}
                dot={{ r: 2.5, strokeWidth: 0, fill: l.color ?? SERIES[i % SERIES.length] }} activeDot={{ r: 4 }} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </HScroll>
  );
}

// Grouped bars: one bar per series at each x label (line-chart alternative).
export function KVGroupedBarChart({
  data, xKey, bars, height = 260, yDomain = [0, 100],
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: LineDef[];
  height?: number;
  yDomain?: [number, number];
}) {
  const minWidth = data.length * Math.max(bars.length * 16, 64);
  return (
    <HScroll minWidth={minWidth}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid stroke={C.hair} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...axis} interval={0} height={30} tickMargin={6} />
          <YAxis domain={yDomain} {...axis} width={40} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "#2563eb", fillOpacity: 0.06 }} />
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color ?? SERIES[i % SERIES.length]} radius={[3, 3, 0, 0]} maxBarSize={16} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </HScroll>
  );
}

export function KVBarChart({
  data, xKey, valueKey, height = 260, horizontal = false, colorByBand = false, showValues = true, maxDomain = 100,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  valueKey: string;
  height?: number;
  horizontal?: boolean;
  colorByBand?: boolean;
  showValues?: boolean;
  maxDomain?: number;
}) {
  const BAR = "#2563eb"; // clear royal-blue bars (was gold/mud)
  const bandColor: Record<string, string> = { A1: C.up, A2: C.up, B1: "#65a30d", B2: "#65a30d", C1: C.watch, C2: C.watch, D: C.down, E: C.down };
  // Vertical bars with many categories scroll horizontally instead of squashing;
  // horizontal bars grow taller so each row stays readable.
  const minWidth = !horizontal && data.length > 8 ? data.length * 52 : undefined;
  const h = horizontal ? Math.max(height, data.length * 34 + 24) : height;
  const chart = (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 24, left: horizontal ? 8 : -12, bottom: 4 }}>
        <CartesianGrid stroke={C.hair} strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" domain={[0, maxDomain]} {...axis} />
            <YAxis type="category" dataKey={xKey} {...axis} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axis} />
            <YAxis domain={[0, maxDomain]} {...axis} width={40} />
          </>
        )}
        <Tooltip content={<TooltipBox />} cursor={{ fill: C.panel }} />
        <Bar dataKey={valueKey} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44}>
          {showValues && (
            <LabelList dataKey={valueKey} position={horizontal ? "right" : "top"} className="tabular"
              style={{ fill: "#111827", fontSize: 11, fontWeight: 600 }} />
          )}
          {data.map((d, i) => (
            <Cell key={i} fill={colorByBand ? bandColor[String(d[xKey])] ?? BAR : BAR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  return <HScroll minWidth={minWidth}>{chart}</HScroll>;
}
