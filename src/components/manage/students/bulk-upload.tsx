"use client";
import { useId, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExcelIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { findExistingAdmissionNos, importStudents } from "@/app/dashboard/manage/students/actions";
import { parseCsv, readImport, templateCsv, type ImportRow, type SectionRef } from "@/app/dashboard/manage/students/rules";

const SHOW_MAX = 500;
const GENDER: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

function downloadTemplate() {
  // The BOM makes Excel open the file as UTF-8, so Hindi names survive.
  const blob = new Blob(["﻿" + templateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Bulk upload: read a CSV in the browser, show every row with its problems,
// then add or update the good rows by admission no.
export function BulkUpload({ sections, onImported }: { sections: SectionRef[]; onImported: (message: string) => void }) {
  const inputId = useId();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();

  const labelOf = new Map(sections.map((s) => [s.id, s.label]));

  async function choose(file: File | undefined) {
    setRows(null);
    setProblem(null);
    setExisting(new Set());
    if (!file) return;
    setFileName(file.name);
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      setProblem("This is an Excel file. In Excel, choose File → Save As → \"CSV (Comma delimited)\", then upload that file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { setProblem("This file is too big. Please upload at most 2000 students at a time."); return; }
    setReading(true);
    try {
      const result = readImport(parseCsv(await file.text()), sections);
      if (result.problem) { setProblem(result.problem); return; }
      if (result.rows.length > 2000) { setProblem("Please upload at most 2000 students at a time."); return; }
      const good = result.rows.filter((r) => !r.errors.length).map((r) => r.admissionNo);
      const found = good.length ? await findExistingAdmissionNos(good) : [];
      setExisting(new Set(found.map((a) => a.toUpperCase())));
      setRows(result.rows);
    } catch {
      setProblem("We could not read this file. Please check it is a CSV file saved from Excel.");
    } finally {
      setReading(false);
    }
  }

  const good = rows?.filter((r) => !r.errors.length) ?? [];
  const bad = rows ? rows.length - good.length : 0;
  const updates = good.filter((r) => existing.has(r.admissionNo.toUpperCase())).length;
  // Rows with problems first, so they are the first thing the office sees.
  const shown = rows ? [...rows].sort((a, b) => Number(!a.errors.length) - Number(!b.errors.length) || a.line - b.line).slice(0, SHOW_MAX) : [];

  function runImport() {
    setProblem(null);
    start(async () => {
      const res = await importStudents(good);
      if (!res.ok) { setProblem(res.error); return; }
      const parts = [];
      if (res.added) parts.push(`${res.added} new ${res.added === 1 ? "student" : "students"} added`);
      if (res.updated) parts.push(`${res.updated} updated`);
      onImported(`Upload finished: ${parts.join(", ")}.`);
    });
  }

  return (
    <Card>
      <CardHeader title="Upload a list of students" />
      <CardBody>
        <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink-900">
          <li>
            Download the template and fill in one student per row.{" "}
            <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 font-medium text-[#0F6CBD] hover:underline">
              <ExcelIcon size={15} />Download template
            </button>
          </li>
          <li>Write the class like <span className="font-medium">VIII-A</span>. Dates can be like <span className="font-medium">15/08/2012</span>.</li>
          <li>In Excel, save it as <span className="font-medium">CSV</span>, then choose the file below. Students already in the school (same admission no) are updated.</li>
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor={inputId}
            className="inline-flex h-10 cursor-pointer items-center rounded-sm border border-hair bg-panel px-4 text-[14px] font-medium text-ink-900 hover:bg-gold-100">
            Choose file
          </label>
          <input id={inputId} type="file" accept=".csv,text/csv,.xlsx,.xls" className="sr-only"
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
          <span className="text-[13px] text-ink-500">{reading ? "Reading the file…" : fileName || "No file chosen"}</span>
        </div>

        {problem && <p role="alert" className="mt-3 text-[13px] font-medium text-down">{problem}</p>}

        {rows && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-ink-900">
                <span className="font-semibold tabular">{good.length}</span> ready
                {updates > 0 && <> (<span className="tabular">{updates}</span> already in the school, will be updated)</>}
                {bad > 0 && <> · <span className="font-semibold tabular text-down">{bad}</span> <span className="text-down">with problems, will be skipped</span></>}
              </p>
              <Button disabled={!good.length || pending} onClick={runImport}>
                {pending ? "Importing…" : `Import ${good.length} ${good.length === 1 ? "student" : "students"}`}
              </Button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr className="text-left text-ink-700">
                    <th className="py-2 font-semibold">Line</th>
                    <th className="py-2 font-semibold">Full name</th>
                    <th className="py-2 font-semibold">Admission no</th>
                    <th className="py-2 font-semibold">Class</th>
                    <th className="py-2 font-semibold">Date of birth</th>
                    <th className="py-2 font-semibold">Gender</th>
                    <th className="py-2 font-semibold">Roll no</th>
                    <th className="py-2 font-semibold">Parent</th>
                    <th className="py-2 font-semibold">Phone</th>
                    <th className="py-2 font-semibold">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.line} className={cn(r.errors.length && "bg-down-soft")}>
                      <td className="py-1.5 tabular text-ink-900">{r.line}</td>
                      <td className="py-1.5 text-ink-900">{r.fullName || "—"}</td>
                      <td className="py-1.5 tabular text-ink-900">{r.admissionNo || "—"}</td>
                      <td className="py-1.5 text-ink-900">{r.sectionId ? labelOf.get(r.sectionId) : r.sectionLabel || "—"}</td>
                      <td className="py-1.5 tabular text-ink-900">{r.dob ? r.dob.split("-").reverse().join("/") : "—"}</td>
                      <td className="py-1.5 text-ink-900">{r.gender ? GENDER[r.gender] : "—"}</td>
                      <td className="py-1.5 tabular text-ink-900">{r.rollNo ?? "—"}</td>
                      <td className="py-1.5 text-ink-900">{r.parentName ? `${r.parentName}${r.relation ? ` (${r.relation})` : ""}` : "—"}</td>
                      <td className="py-1.5 tabular text-ink-900">{r.phone || "—"}</td>
                      <td className="py-1.5">
                        {r.errors.length ? (
                          <ul className="space-y-0.5 font-medium text-down">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                        ) : existing.has(r.admissionNo.toUpperCase()) ? (
                          <span className="text-ink-700">Will update</span>
                        ) : (
                          <span className="font-medium text-up">New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > SHOW_MAX && (
              <p className="mt-2 text-[13px] text-ink-500">Showing the first {SHOW_MAX} of {rows.length} rows. All good rows will be imported.</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
