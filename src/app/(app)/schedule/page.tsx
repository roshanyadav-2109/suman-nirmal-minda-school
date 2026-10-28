import Link from "next/link";
import { getSession, getCurrentYear } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { getStaffScope } from "@/lib/data/scope";
import { getMyChildren } from "@/lib/data/analytics";
import {
  getPeriods, getSectionSlots, getStaffSlots, sectionCells, teacherCells, getStudentSection,
  getTeachingStaff, getSectionAllotments, schoolToday,
} from "@/lib/data/schedule";
import { WeekGrid } from "@/components/schedule/week-grid";
import { SchedulePicker } from "@/components/schedule/schedule-picker";
import { TimetableEditor } from "@/components/schedule/timetable-editor";
import { BellScheduleForm } from "@/components/schedule/bell-schedule-form";
import { toggleCls } from "@/components/schedule/shared";
import { cn, numParam, strParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const TITLE = "Schedule";

const pill = (on: boolean) => cn("inline-flex h-9 items-center rounded-sm border px-3 text-[13px] font-medium transition-colors", toggleCls(on));

function NotSetUp() {
  return (
    <div>
      <PageHeader title={TITLE} />
      <EmptyState art="coming-soon" title="The timetable isn't set up yet" hint="The office can set it up once the school's timetable is entered." />
    </div>
  );
}

export default async function SchedulePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [session, year, bell] = await Promise.all([getSession(), getCurrentYear(), getPeriods()]);
  if (!session) return null;
  if (bell.missing) return <NotSetUp />;
  if (!year) return (<div><PageHeader title={TITLE} /><EmptyState title="No school year is open yet" /></div>);

  const periods = bell.periods;
  const today = schoolToday();
  const isOffice = session.staffRole === "office";

  if (!periods.length && !isOffice) return <NotSetUp />;

  // ---- Student / parent: their own section ----
  if (session.role === "student" || session.role === "guardian") {
    let studentId = session.studentId;
    let children: { id: number; full_name: string }[] = [];
    if (session.role === "guardian") {
      children = await getMyChildren();
      const want = numParam(sp.child);
      studentId = children.find((c) => c.id === want)?.id ?? children[0]?.id ?? null;
    }
    const section = studentId ? await getStudentSection(studentId, year.id) : null;
    const child = children.find((c) => c.id === studentId);
    const cells = section ? await sectionCells(await getSectionSlots(section.id, year.id)) : {};
    return (
      <div>
        <PageHeader eyebrow={section ? (child ? `${child.full_name} · ${section.label}` : section.label) : undefined} title={TITLE}
          description="Your class's lessons for the week." />
        {children.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {children.map((c) => (
              <Link prefetch={false} key={c.id} href={`/schedule?child=${c.id}`} className={pill(c.id === studentId)}>{c.full_name}</Link>
            ))}
          </div>
        )}
        {section ? (
          <WeekGrid periods={periods} cells={cells} today={today}
            note={Object.keys(cells).length ? undefined : "The lessons for this class haven't been entered yet."} />
        ) : (
          <EmptyState art="no-sections" title="No class found for this year" hint="Please contact the school office." />
        )}
      </div>
    );
  }

  // ---- Principal / office: any class or any teacher ----
  if (session.isAdminScope) {
    const [scope, teachers] = await Promise.all([getStaffScope(), getTeachingStaff()]);
    const sections = scope.sectionMeta.map((m) => ({ id: m.id, name: m.label, classId: m.classId }));
    const teacherId = numParam(sp.teacher);
    const mode: "section" | "teacher" = teacherId && teachers.some((t) => t.id === teacherId) ? "teacher" : "section";
    const section = sections.find((s) => s.id === numParam(sp.section)) ?? sections[0];
    const editing = isOffice && mode === "section" && !!section && strParam(sp.edit) === "1";
    const bellOpen = isOffice && (strParam(sp.bell) === "1" || !periods.length);

    const actions = isOffice ? (
      <>
        {mode === "section" && section && (
          editing
            ? <Link prefetch={false} href={`/schedule?section=${section.id}`} className={pill(true)}>Done editing</Link>
            : <Link prefetch={false} href={`/schedule?section=${section.id}&edit=1`} className={pill(false)}>Edit timetable</Link>
        )}
        <Link prefetch={false} href={bellOpen ? `/schedule${section ? `?section=${section.id}` : ""}` : `/schedule?bell=1${section ? `&section=${section.id}` : ""}`}
          className={pill(bellOpen)}>Bell times</Link>
      </>
    ) : undefined;

    const header = (
      <PageHeader title={TITLE} description="See the week for any class or any teacher." actions={actions} />
    );

    if (bellOpen) {
      return (
        <div>
          {header}
          <div className="max-w-3xl"><BellScheduleForm periods={periods} /></div>
        </div>
      );
    }

    if (!sections.length) return (<div>{header}<EmptyState art="no-sections" title="No classes found" /></div>);

    const picker = (
      <SchedulePicker mode={mode} sections={sections.map(({ id, name }) => ({ id, name }))} teachers={teachers}
        sectionId={section?.id ?? null} teacherId={mode === "teacher" ? teacherId : null} />
    );

    if (mode === "teacher" && teacherId) {
      const cells = await teacherCells(await getStaffSlots(teacherId, year.id));
      return (
        <div>
          {header}
          {picker}
          <WeekGrid periods={periods} cells={cells} today={today}
            note={Object.keys(cells).length ? undefined : "This teacher has no periods on the timetable yet."} />
        </div>
      );
    }

    const slots = await getSectionSlots(section.id, year.id);
    if (editing) {
      const { bySubject, classTeacher } = await getSectionAllotments(section.id, year.id);
      const subjects = (scope.subjectsByClass[section.classId] ?? scope.subjects).map((s) => ({ id: s.id, name: s.name }));
      return (
        <div>
          {header}
          {picker}
          <TimetableEditor key={section.id} sectionId={section.id} sectionLabel={section.name} yearId={year.id}
            periods={periods} slots={slots} subjects={subjects} bySubject={bySubject} classTeacher={classTeacher}
            allStaff={teachers} otherSections={sections.filter((s) => s.id !== section.id).map(({ id, name }) => ({ id, name }))} />
        </div>
      );
    }

    const cells = await sectionCells(slots);
    return (
      <div>
        {header}
        {picker}
        <WeekGrid periods={periods} cells={cells} today={today}
          note={Object.keys(cells).length ? undefined
            : isOffice ? `No lessons have been entered for ${section.name} yet. Press "Edit timetable" to fill them in.`
            : `No lessons have been entered for ${section.name} yet.`} />
      </div>
    );
  }

  // ---- Teachers (and other staff): my week, or my class's week ----
  if (!session.staffId) return (<div><PageHeader title={TITLE} /><EmptyState title="Nothing to show" /></div>);
  const scope = await getStaffScope();
  const myClass = scope.classSectionId ? scope.sectionMeta.find((m) => m.id === scope.classSectionId) ?? null : null;
  const view: "mine" | "class" = myClass && strParam(sp.view) === "class" ? "class" : "mine";

  const cells = view === "class" && myClass
    ? await sectionCells(await getSectionSlots(myClass.id, year.id))
    : await teacherCells(await getStaffSlots(session.staffId, year.id));

  return (
    <div>
      <PageHeader eyebrow={view === "class" && myClass ? myClass.label : undefined} title={TITLE}
        description={view === "class" ? "Every lesson of your class this week, with the teacher who takes it." : "Every period you teach this week."} />
      {myClass && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link prefetch={false} href="/schedule" className={pill(view === "mine")}>My week</Link>
          <Link prefetch={false} href="/schedule?view=class" className={pill(view === "class")}>My class ({myClass.label})</Link>
        </div>
      )}
      <WeekGrid periods={periods} cells={cells} today={today}
        note={Object.keys(cells).length ? undefined
          : view === "class" ? "The lessons for your class haven't been entered yet." : "You have no periods on the timetable yet."} />
    </div>
  );
}
