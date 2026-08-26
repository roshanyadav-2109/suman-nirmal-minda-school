"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { commitPromotion, type PromotionDecision } from "@/app/(app)/promotion/actions";
import type { PromRow, SectionOpt } from "@/lib/data/promotion";

type Outcome = "promoted" | "retained" | "transferred" | "graduated";
type Draft = { outcome: Outcome; toSectionId: number | null };

export function PromotionConsole({
  fromYear, toYear, toYearName, className, roster, sameSections, nextSections, graduating,
}: {
  fromYear: number; toYear: number; toYearName: string; className: string;
  roster: PromRow[]; sameSections: SectionOpt[]; nextSections: SectionOpt[]; graduating: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const promoteOutcome: Outcome = graduating ? "graduated" : "promoted";

  const defaultSection = (curName: string) => nextSections.find((s) => s.name === curName)?.id ?? nextSections[0]?.id ?? null;

  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const seed: Record<number, Draft> = {};
    for (const r of roster) {
      const outcome = (r.outcome as Outcome) ?? promoteOutcome;
      const toSectionId = r.toSectionId ?? (outcome === "retained" ? r.sectionId : outcome === "promoted" ? defaultSection(r.sectionName) : null);
      seed[r.id] = { outcome, toSectionId };
    }
    return seed;
  });

  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function setRow(id: number, patch: Partial<Draft>) {
    setDrafts((d) => {
      const cur = { ...d[id], ...patch };
      // keep a sensible target section when the action changes
      if (patch.outcome) {
        const r = roster.find((x) => x.id === id)!;
        if (patch.outcome === "promoted") cur.toSectionId = defaultSection(r.sectionName);
        else if (patch.outcome === "retained") cur.toSectionId = r.sectionId;
        else cur.toSectionId = null;
      }
      return { ...d, [id]: cur };
    });
  }
  function setAllOutcome(outcome: Outcome) { for (const r of roster) setRow(r.id, { outcome }); }
  function setAllPromoteSection(sectionId: number | "auto") {
    setDrafts((d) => {
      const next = { ...d };
      for (const r of roster) if (next[r.id].outcome === "promoted")
        next[r.id] = { ...next[r.id], toSectionId: sectionId === "auto" ? defaultSection(r.sectionName) : sectionId };
      return next;
    });
  }

  const counts = useMemo(() => {
    const c = { promoted: 0, retained: 0, transferred: 0, graduated: 0 };
    for (const r of roster) c[drafts[r.id].outcome]++;
    return c;
  }, [drafts, roster]);

  function commit() {
    setErr(null); setDone(null);
    const rows: PromotionDecision[] = roster.map((r) => ({
      student_id: r.id,
      outcome: drafts[r.id].outcome,
      to_section_id: (drafts[r.id].outcome === "promoted" || drafts[r.id].outcome === "retained") ? drafts[r.id].toSectionId : null,
    }));
    start(async () => {
      const res = await commitPromotion({ fromYear, toYear, rows });
      if (res.ok) { setDone({ count: res.count }); router.refresh(); }
      else setErr(res.error);
    });
  }

  const outcomeStyles: Record<Outcome, string> = {
    promoted: "text-up", retained: "text-watch", transferred: "text-down", graduated: "text-gold-700",
  };

  return (
    <Card>
      <CardHeader eyebrow={t("x.promoteTo", { year: toYearName })} title={t("x.classRoster", { cls: className })}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted">{t("x.setAll")}</span>
            <Button size="sm" variant="ghost" onClick={() => setAllOutcome(promoteOutcome)}>{graduating ? t("x.graduate") : t("x.promote")}</Button>
            {!graduating && nextSections.length > 0 && (
              <Select className="h-9 w-auto" onChange={(e) => setAllPromoteSection(e.target.value === "auto" ? "auto" : Number(e.target.value))} defaultValue="auto">
                <option value="auto">{t("x.sameLetter")}</option>
                {nextSections.map((s) => (<option key={s.id} value={s.id}>→ {s.name}</option>))}
              </Select>
            )}
          </div>
        } />
      <CardBody className="pt-2">
        <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
          <Tally label={t("x.promoted")} n={counts.promoted} cls="bg-up-soft text-up" />
          <Tally label={t("x.retained")} n={counts.retained} cls="bg-watch-soft text-watch" />
          <Tally label={t("x.transferred")} n={counts.transferred} cls="bg-down-soft text-down" />
          {graduating && <Tally label={t("x.graduated")} n={counts.graduated} cls="bg-gold-100 text-gold-700" />}
        </div>

        <ul className="divide-y divide-hair">
          {roster.map((r) => {
            const d = drafts[r.id];
            const sectionOpts = d.outcome === "promoted" ? nextSections : d.outcome === "retained" ? sameSections : [];
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-ink-700 tabular">{r.roll ?? "–"}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink-900">{r.name}</span>
                <span className="rounded-xs bg-panel px-1.5 py-0.5 text-[11px] tabular text-ink-500">{className}-{r.sectionName}</span>
                <Select className={cn("h-9 w-auto min-w-[120px] font-medium", outcomeStyles[d.outcome])} value={d.outcome} onChange={(e) => setRow(r.id, { outcome: e.target.value as Outcome })}>
                  <option value={promoteOutcome}>{graduating ? t("x.graduate") : t("x.promote")}</option>
                  <option value="retained">{t("x.retain")}</option>
                  <option value="transferred">{t("x.transfer")}</option>
                </Select>
                {sectionOpts.length > 0 ? (
                  <Select className="h-9 w-auto min-w-[90px]" value={d.toSectionId ?? ""} onChange={(e) => setRow(r.id, { toSectionId: Number(e.target.value) })}>
                    {sectionOpts.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </Select>
                ) : (
                  <span className="w-[90px] text-center text-[12px] text-muted">—</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={commit} disabled={pending || !roster.length}>{pending ? t("common.saving") : t("x.commitPromotion")}</Button>
          {done && <span className="text-[13px] font-medium text-up">{t("x.promotionDone", { n: done.count })}</span>}
          {err && <span className="text-[13px] font-medium text-down">{err}</span>}
        </div>
      </CardBody>
    </Card>
  );
}

function Tally({ label, n, cls }: { label: string; n: number; cls: string }) {
  return <span className={cn("rounded-sm px-2 py-1 font-semibold tabular", cls)}>{n} {label}</span>;
}
