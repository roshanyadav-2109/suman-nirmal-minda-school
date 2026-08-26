// Demo accounts seeded in the database. Password is the same for all — this is
// a synthetic demo. Each lands in a DB-scoped view (RLS enforces the rest).
export const DEMO_PASSWORD = "kviit@demo1";

// One teacher = one unified portal (class teacher of their own section +
// subject teacher elsewhere). A single "Teacher" demo login, not two.
export const DEMO_ACCOUNTS = [
  { email: "principal@kv.demo", role: "principal", name: "Dr. Sudeshna Banerjee", note: "Whole school" },
  { email: "classteacher@kv.demo", role: "teacher", name: "Mrs. Anindita Sen", note: "Class teacher VIII-A + Science in other sections" },
  { email: "parent@kv.demo", role: "guardian", name: "Demo Parent", note: "Two children" },
  { email: "student@kv.demo", role: "student", name: "Arjun Dey", note: "Class VIII-A" },
  { email: "office@kv.demo", role: "office", name: "Mr. Amit Kar", note: "Office / Admin" },
] as const;
