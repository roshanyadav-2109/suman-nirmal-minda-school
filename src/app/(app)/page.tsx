import { getSession } from "@/lib/session";
import { StudentDashboard } from "@/components/dashboards/student-dashboard";
import { GuardianDashboard } from "@/components/dashboards/guardian-dashboard";
import { TeacherDashboard } from "@/components/dashboards/teacher-dashboard";
import { PrincipalDashboard } from "@/components/dashboards/principal-dashboard";
import { OfficeDashboard } from "@/components/dashboards/office-dashboard";

// Thin router: each role has its OWN dashboard file, not one file with hiding.
export default async function DashboardPage() {
  const session = (await getSession())!;
  switch (session.effectiveRole) {
    case "student":
      return <StudentDashboard session={session} />;
    case "guardian":
      return <GuardianDashboard session={session} />;
    case "principal":
      return <PrincipalDashboard session={session} />;
    case "office":
      return <OfficeDashboard session={session} />;
    default: // subject_teacher | class_teacher
      return <TeacherDashboard session={session} />;
  }
}
