import Link from "next/link";
import { getSession, getCurrentYear } from "@/lib/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { FilterBar } from "@/components/progress/filter-bar";
import { StudentProgressView } from "@/components/progress/student-progress-view";
import { SessionChooser } from "@/components/progress/session-chooser";
import { SectionAnalyticsView } from "@/components/progress/section-analytics-view";
import { ClassAnalyticsView } from "@/components/progress/class-analytics-view";
import { ExamAnalyticsView } from "@/components/progress/exam-analytics-view";
import { ProgressIcon, ArrowRightIcon } from "@/components/icons";
import { getStaffScope, getSectionStudents } from "@/lib/data/scope";
import { getSectionAnalytics, getClassAnalytics, getExamAnalytics, getScopeExams, getStudentProgress, getStudentStanding, getMyChildren } from "@/lib/data/analytics";

import { numParam, strParam, cn } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const num = numParam;
const str = strParam;

export default async function ProgressPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = (await getSession())!;
  const { t } = await getT();

  // ---- Owner view (student / guardian): their own continuous record ----------
  if (session.role === "student" || session.role === "guardian") {
    let studentId = session.studentId;
    let children: { id: number; full_name: string; admission_no: string }[] = [];
    if (session.role === "guardian") {
      children = await getMyChildren();
      studentId = num(sp.child) ?? children[0]?.id ?? null;
    }
    if (!studentId) return <EmptyState icon={ProgressIcon} title={t("progress.noMarks")} />;
    const curYear = await getCurrentYear();
    // Session chooser: "lifetime" (full history), or a specific academic year.
    const sessionParam = typeof sp.session === "string" ? sp.session : undefined;
    const lifetime = sessionParam === "lifetime";
    const selectedYearId = lifetime ? null : (num(sessionParam) ?? curYear?.id ?? null);
    const standingYearId = selectedYearId ?? curYear?.id ?? null;
    const [data, standing] = await Promise.all([
      getStudentProgress(studentId, selectedYearId),
      standingYearId ? getStudentStanding(studentId, standingYearId) : Promise.resolve(null),
    ]);
    return (
      <div>
        <SessionChooser
          years={data.years}
          active={lifetime ? "lifetime" : String(selectedYearId ?? "lifetime")}
          lifetimeLabel={t("progress.lifetime")}
          childId={session.role === "guardian" ? studentId : undefined}
          leading={session.role === "guardian" && children.length > 1
            ? children.map((c) => {
                const active = c.id === studentId;
                return (
                  <Link key={c.id} href={`/progress?child=${c.id}`}
                    className={cn("rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors",
                      active ? "border-black bg-black text-white" : "border-hair bg-surface text-ink-900 hover:bg-panel")}>
                    {c.full_name}
                  </Link>
                );
              })
            : undefined}
        />
        <StudentProgressView data={data} standing={standing} />
      </div>
    );
  }

  // ---- Staff view: section / class analytics, scoped by allotment -------------
  const scope = await getStaffScope();
  if (!scope.sections.length || !scope.currentYearId) {
    return (
      <div>
        <PageHeader title={t("progress.title")} />
        <EmptyState icon={ProgressIcon} title={t("progress.noMarks")} hint={t("x.progNoSections")} />
      </div>
    );
  }

  const yearId = num(sp.year) ?? scope.currentYearId;

  const classId = num(sp.class);
  const level: "class" | "section" = classId ? "class" : "section";
  const section = scope.sections.find((s) => s.id === num(sp.section)) ?? scope.sections[0];
  const cls = classId ? (scope.classes.find((c) => c.id === classId) ?? scope.classes[0]) : null;
  const scopeId = level === "class" && cls ? cls.id : section.id;

  // Sections that the current scope covers (all of a class, or one section).
  const scopeSectionIds = level === "class" && cls
    ? scope.sections.filter((s) => s.class_id === cls.id).map((s) => s.id)
    : [section.id];

  // Filters carry over across scope changes; keep a chosen subject/exam only when
  // it still exists in the new scope, otherwise fall back to "All".
  const availableSubjects = level === "class" && cls
    ? (scope.subjectsByClass[cls.id] ?? scope.subjects)
    : (scope.sectionMeta.find((s) => s.id === section.id)?.subjects ?? []);
  const wantSubject = num(sp.subject);
  const subjectId = wantSubject != null && availableSubjects.some((s) => s.id === wantSubject) ? wantSubject : null;
  const subjectName = subjectId ? scope.subjects.find((s) => s.id === subjectId)?.name ?? null : null;

  // Exam options for the scope (all subjects, or the chosen subject).
  const exams = await getScopeExams(scopeSectionIds, subjectId, yearId);
  const wantExam = str(sp.exam);
  const examName = wantExam && exams.some((e) => e.name === wantExam) ? wantExam : null;

  // Students in the current scope (one section, or every section of the class) —
  // this list drives the Student picker and refreshes when the scope changes.
  const scopeRoster = level === "class" && cls
    ? (await Promise.all(scopeSectionIds.map((id) => getSectionStudents(id, yearId)))).flat().sort((a, b) => a.name.localeCompare(b.name))
    : await getSectionStudents(section.id, yearId);
  const wantStudent = num(sp.studentId);
  const studentId = wantStudent != null && scopeRoster.some((s) => s.id === wantStudent) ? wantStudent : null;

  const filters = (
    <FilterBar years={scope.years} classes={scope.classes} sectionMeta={scope.sectionMeta} subjects={scope.subjects} subjectsByClass={scope.subjectsByClass}
      exams={exams.map((e) => e.name)} examName={examName}
      students={scopeRoster.map((s) => ({ id: s.id, name: s.name }))} studentId={studentId}
      yearId={yearId} level={level} scopeId={scopeId} subjectId={subjectId} />
  );

  // One pupil's record — works from any scope (section or whole class).
  if (studentId) {
    const [data, standing] = await Promise.all([
      getStudentProgress(studentId),
      getStudentStanding(studentId, yearId),
    ]);
    const backQs = new URLSearchParams({ year: String(yearId) });
    if (level === "class" && cls) backQs.set("class", String(cls.id)); else backQs.set("section", String(section.id));
    if (subjectId) backQs.set("subject", String(subjectId));
    const backLabel = level === "class" && cls ? `${t("common.class")} ${cls.name}` : `${section.class_name}-${section.name}`;
    return (
      <div>
        <PageHeader title={t("progress.title")}
          description={data.student ? `${data.student.full_name} · ${data.student.admission_no}` : undefined} />
        {filters}
        <Link href={`/progress?${backQs.toString()}`} className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-[rgb(37,99,235)] hover:underline">
          <ArrowRightIcon size={14} className="rotate-180" /> {backLabel}
        </Link>
        <StudentProgressView data={data} standing={standing} />
      </div>
    );
  }

  // Exam-scoped view: one exam across the scope (optionally one subject).
  if (examName) {
    const data = await getExamAnalytics(scopeSectionIds, subjectId, yearId, examName);
    return (
      <div>
        <PageHeader title={t("progress.title")}
          description={`${scope.isAdmin ? t("x.progSchoolScope") : t("x.progAllottedScope")}`} />
        {filters}
        <ExamAnalyticsView data={data} examName={examName} subjectName={subjectName} />
      </div>
    );
  }

  // Whole-class view: aggregate all sections + section-vs-section comparison
  if (level === "class" && cls) {
    const sectionIds = scopeSectionIds;
    const data = await getClassAnalytics(cls.id, sectionIds, yearId, subjectId);
    return (
      <div>
        <PageHeader title={t("progress.title")}
          description={`${sectionIds.length} ${t("common.section").toLowerCase()}(s)`} />
        {filters}
        <ClassAnalyticsView data={data} subjectName={subjectName} />
      </div>
    );
  }

  const analytics = await getSectionAnalytics(section.id, section.class_id, yearId, subjectId);

  return (
    <div>
      <PageHeader title={t("progress.title")}
        description={`${scope.isAdmin ? t("x.progSchoolScope") : t("x.progAllottedScope")} · ${t("x.scopeSections", { n: scope.sections.length })}`} />
      {filters}
      <SectionAnalyticsView data={analytics} roster={scopeRoster} subjectName={subjectName} />
    </div>
  );
}
