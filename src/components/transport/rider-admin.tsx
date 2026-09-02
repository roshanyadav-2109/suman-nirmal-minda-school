"use client";
import { useId, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/field";
import { BusIcon, SearchIcon } from "@/components/icons";
import { useT } from "@/i18n/provider";
import {
  assignTransport, updateTransport, removeTransport,
  type TransportResult,
} from "@/app/(app)/transport/actions";
import type { RiderAdmin as RiderAdminData, RouteWithStops } from "@/lib/data/transport";

// The office's allotment desk: who rides a bus, and where they board. Nothing
// here decides authorisation — every mutation goes through the server actions
// and comes back with a message key when RLS says no.

type Draft = { routeId: number; pickupStopId: number; dropStopId: number };
/** Which row owns the inline form, so only one is ever open. */
type Focus = { kind: "edit" | "allot"; id: number } | null;

export function RiderAdmin({ data }: { data: RiderAdminData }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [focus, setFocus] = useState<Focus>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [note, setNote] = useState<{ on: string; key: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const upages = Math.max(1, Math.ceil(data.unassignedTotal / data.unassignedPageSize));
  const routeId = Number(params.get("route")) || 0;
  const filtered = Boolean(params.get("q")) || routeId > 0;

  function push(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    // Any change of filter invalidates the page the office was standing on.
    // Changing a filter invalidates whichever page each panel was standing on;
    // paging one panel must leave the other where it was.
    if (!("page" in patch) && !("upage" in patch)) { next.delete("page"); next.delete("upage"); }
    router.push(`${pathname}?${next.toString()}`);
  }

  function run(on: string, action: () => Promise<TransportResult>, okKey: string) {
    setNote(null);
    start(async () => {
      const res = await action();
      if (!res.ok) { setNote({ on, key: res.key, ok: false }); return; }
      setNote({ on, key: okKey, ok: true });
      setFocus(null);
      setConfirming(null);
      router.refresh();
    });
  }

  const Outcome = ({ on }: { on: string }) =>
    note?.on === on ? (
      <p className={`mt-2 text-[13px] font-medium ${note.ok ? "text-up" : "text-down"}`}>{t(note.key)}</p>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Outcomes outlive the row they came from: removing a rider deletes the
          row, and with it any message rendered inside it. */}
      {note && (
        <div
          role="status"
          className={`rounded-md border px-4 py-2.5 text-[13px] font-medium ${
            note.ok ? "border-hair bg-gold-100 text-ink-900" : "border-hair bg-panel text-down"
          }`}
        >
          {t(note.key)}
        </div>
      )}
      {/* One search box serves both panels: the office types a name once and
          sees whether that pupil already has a bus or is still waiting. */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-hair bg-surface p-3">
        <form className="min-w-[240px] flex-1" onSubmit={(e) => { e.preventDefault(); push({ q }); }}>
          <label className="t-label mb-1 block" htmlFor="rider-q">{t("common.search")}</label>
          <div className="flex gap-2">
            <Input id="rider-q" value={q} placeholder={t("transport.searchPupils")} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" variant="subtle" aria-label={t("common.search")}>
              <SearchIcon size={16} />
            </Button>
          </div>
        </form>
        <div className="min-w-[200px]">
          <label className="t-label mb-1 block" htmlFor="rider-route">
            {t("transport.route")} <span className="font-normal normal-case text-ink-500">{t("transport.routeFilterScope")}</span>
          </label>
          <Select id="rider-route" value={routeId || ""}
            onChange={(e) => push({ route: e.target.value, q })}>
            <option value="">{t("common.all")}</option>
            {data.routes.map((r) => (
              <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* ---- Pupils already on a bus ---- */}
        <Card>
          <CardHeader
            title={t("transport.riderAdmin")}
            action={<span className="t-label tabular">{data.total} {t("transport.totalRiders")}</span>}
          />
          <CardBody className="pt-2">
            {data.riders.length === 0 ? (
              <EmptyState
                icon={BusIcon}
                title={filtered ? t("transport.noResults") : t("transport.noRiders")}
                hint={filtered ? t("transport.noResultsHint") : t("transport.noRidersHint")}
              />
            ) : (
              <ul className="divide-y divide-hair">
                {data.riders.map((r) => {
                  const open = focus?.kind === "edit" && focus.id === r.id;
                  return (
                    <li key={r.id} className="py-3 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-ink-900">{r.studentName}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-500">
                            <span className="tabular">{r.admissionNo}</span>
                            <span aria-hidden>·</span>
                            <span>{r.classSection ?? "—"}</span>
                            <span aria-hidden>·</span>
                            <span className="text-ink-900">{r.routeCode}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-ink-500">
                            {t("transport.pickupStop")}: {r.pickupStopName}
                            {r.dropStopId !== r.pickupStopId && ` · ${t("transport.dropStop")}: ${r.dropStopName}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button size="sm" variant="subtle"
                            onClick={() => { setConfirming(null); setFocus(open ? null : { kind: "edit", id: r.id }); }}>
                            {t("transport.changeStop")}
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { setFocus(null); setConfirming(confirming === r.id ? null : r.id); }}>
                            {t("transport.removeRider")}
                          </Button>
                        </div>
                      </div>

                      {open && (
                        <div className="mt-3 rounded-sm border border-hair bg-panel p-3">
                          <StopForm
                            routes={data.routes}
                            initial={{ routeId: r.routeId, pickupStopId: r.pickupStopId, dropStopId: r.dropStopId }}
                            pending={pending}
                            onCancel={() => setFocus(null)}
                            onSave={(d) => run(`edit-${r.id}`, () => updateTransport({ id: r.id, ...d }), "transport.saved")}
                          />
                        </div>
                      )}

                      {confirming === r.id && (
                        <div className="mt-3 rounded-sm border border-hair bg-panel p-3">
                          <p className="text-[13px] text-ink-900">{t("transport.confirmRemove")}</p>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="danger" disabled={pending}
                              onClick={() => run(`edit-${r.id}`, () => removeTransport({ id: r.id }), "transport.removed")}>
                              {pending ? t("transport.saving") : t("transport.removeRider")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>{t("transport.cancel")}</Button>
                          </div>
                        </div>
                      )}

                      <Outcome on={`edit-${r.id}`} />
                    </li>
                  );
                })}
              </ul>
            )}

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button size="sm" variant="subtle" disabled={data.page === 0}
                  onClick={() => push({ page: String(data.page - 1) })}>{t("transport.prev")}</Button>
                <span className="text-[13px] tabular text-ink-500">
                  {t("transport.page")} {data.page + 1} {t("transport.of")} {pages}
                </span>
                <Button size="sm" variant="subtle" disabled={data.page + 1 >= pages}
                  onClick={() => push({ page: String(data.page + 1) })}>{t("transport.next")}</Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ---- Pupils with no bus yet ---- */}
        <Card>
          <CardHeader
            title={t("transport.unassignedPupils")}
            action={
              <span className="t-label tabular">
                {t("transport.showingOf", { shown: data.unassigned.length, total: data.unassignedTotal })}
              </span>
            }
          />
          <CardBody className="pt-2">
            {data.unassigned.length === 0 ? (
              <EmptyState icon={BusIcon} title={t("transport.noResults")} hint={t("transport.noResultsHint")} />
            ) : (
              <ul className="divide-y divide-hair">
                {data.unassigned.map((p) => {
                  const open = focus?.kind === "allot" && focus.id === p.studentId;
                  return (
                    <li key={p.studentId} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] text-ink-900">{p.studentName}</div>
                          <div className="text-[12px] tabular text-ink-500">
                            {p.classSection ?? "—"} · {t("transport.admissionNo")} {p.admissionNo}
                          </div>
                        </div>
                        <Button size="sm" variant={open ? "ghost" : "gold"}
                          onClick={() => setFocus(open ? null : { kind: "allot", id: p.studentId })}>
                          {open ? t("transport.cancel") : t("transport.allotTransport")}
                        </Button>
                      </div>
                      {open && (
                        <div className="mt-3">
                          <StopForm
                            routes={data.routes}
                            pending={pending}
                            onCancel={() => setFocus(null)}
                            onSave={(d) => run(`allot-${p.studentId}`, () => assignTransport({ studentId: p.studentId, ...d }), "transport.saved")}
                          />
                        </div>
                      )}
                      <Outcome on={`allot-${p.studentId}`} />
                    </li>
                  );
                })}
              </ul>
            )}

            {upages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button size="sm" variant="subtle" disabled={data.unassignedPage === 0}
                  onClick={() => push({ upage: String(data.unassignedPage - 1) })}>{t("transport.prev")}</Button>
                <span className="text-[13px] tabular text-ink-500">
                  {t("transport.page")} {data.unassignedPage + 1} {t("transport.of")} {upages}
                </span>
                <Button size="sm" variant="subtle" disabled={data.unassignedPage + 1 >= upages}
                  onClick={() => push({ upage: String(data.unassignedPage + 1) })}>{t("transport.next")}</Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/** Route first, then its own stops in running order — never another route's. */
function StopForm({
  routes, initial, pending, onSave, onCancel,
}: {
  routes: RouteWithStops[];
  initial?: Draft;
  pending: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  const t = useT();
  const [routeId, setRouteId] = useState(initial?.routeId ?? 0);
  const [pickup, setPickup] = useState(initial?.pickupStopId ?? 0);
  const [drop, setDrop] = useState(initial?.dropStopId ?? 0);

  const stops = routes.find((r) => r.id === routeId)?.stops ?? [];

  function chooseRoute(id: number) {
    setRouteId(id);
    // A stop belongs to one route, so the old choices cannot carry over.
    setPickup(0);
    setDrop(0);
  }

  function choosePickup(id: number) {
    // Almost every pupil gets off where they got on, so the drop follows the
    // pickup until the office deliberately picks a different stop.
    if (drop === 0 || drop === pickup) setDrop(id);
    setPickup(id);
  }

  const ready = routeId > 0 && pickup > 0 && drop > 0;

  return (
    <div className="rounded-sm border border-hair bg-panel p-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <div>
          <label className="t-label mb-1 block" htmlFor={`${formId}-route`}>{t("transport.route")}</label>
          <Select id={`${formId}-route`} value={routeId || ""} onChange={(e) => chooseRoute(Number(e.target.value))}>
            <option value="">{t("transport.selectRoute")}</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="t-label mb-1 block" htmlFor={`${formId}-pickup`}>{t("transport.pickupStop")}</label>
          <Select id={`${formId}-pickup`} value={pickup || ""} disabled={!routeId} onChange={(e) => choosePickup(Number(e.target.value))}>
            <option value="">{t("transport.selectStop")}</option>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>{s.seq}. {s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="t-label mb-1 block" htmlFor={`${formId}-drop`}>{t("transport.dropStop")}</label>
          <Select id={`${formId}-drop`} value={drop || ""} disabled={!routeId} onChange={(e) => setDrop(Number(e.target.value))}>
            <option value="">{t("transport.selectStop")}</option>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>{s.seq}. {s.name}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="gold" disabled={!ready || pending}
          onClick={() => onSave({ routeId, pickupStopId: pickup, dropStopId: drop })}>
          {pending ? t("transport.saving") : t("transport.save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("transport.cancel")}</Button>
      </div>
    </div>
  );
}
