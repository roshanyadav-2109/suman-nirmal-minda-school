// Plain rules shared by the office's student screens and their server actions:
// reading a CSV, matching "VIII-A" to a section, checking dates. No database
// access here, so the browser preview and the server agree on every check.

export type Gender = "male" | "female" | "other";

export type SectionRef = { id: number; label: string; className: string; sectionName: string; classLevel: number };

export type GuardianInput = {
  id?: number | null;
  fullName: string;
  relation: string;
  phone: string;
  email: string;
};

export type StudentInput = {
  id?: number | null;
  fullName: string;
  admissionNo: string;
  dob: string;          // "YYYY-MM-DD" or ""
  gender: Gender | "";
  sectionId: number | null;
  rollNo: string;       // "" or a whole number
  studentEmail: string; // "" or the student's own email (for Google sign-in)
  guardian: GuardianInput;
};

// One row of a bulk upload after reading and checking it.
export type ImportRow = {
  line: number;          // line in the file (header is line 1)
  fullName: string;
  admissionNo: string;
  dob: string | null;
  gender: Gender | null;
  sectionId: number | null;
  sectionLabel: string;
  rollNo: number | null;
  parentName: string;
  relation: string;
  phone: string;
  email: string;
  studentEmail: string;
  errors: string[];
};

// The exact headers of the template, in order.
export const TEMPLATE_HEADERS = [
  "Full name",
  "Admission no",
  "Date of birth",
  "Gender",
  "Class-section",
  "Roll no",
  "Parent name",
  "Relation",
  "Parent phone",
  "Parent email",
  "Student email",
] as const;

type Col = "fullName" | "admissionNo" | "dob" | "gender" | "section" | "rollNo" | "parentName" | "relation" | "phone" | "email" | "studentEmail";

// Header spellings people actually use, squashed to letters and digits.
const HEADER_ALIASES: Record<Col, string[]> = {
  fullName: ["fullname", "name", "studentname", "nameofstudent", "student"],
  admissionNo: ["admissionno", "admissionnumber", "admno", "admissionnum", "admission", "srno", "scholarno"],
  dob: ["dateofbirth", "dob", "birthdate", "birthday"],
  gender: ["gender", "sex"],
  section: ["classsection", "class", "section", "classandsection", "classsec"],
  rollNo: ["rollno", "roll", "rollnumber"],
  parentName: ["parentname", "guardianname", "fathername", "mothername", "parent", "guardian", "fathersname", "mothersname"],
  relation: ["relation", "relationship", "relationwithstudent"],
  phone: ["parentphone", "phone", "mobile", "phoneno", "mobileno", "contact", "contactno", "parentmobile", "guardianphone"],
  email: ["parentemail", "email", "emailid", "guardianemail", "mail"],
  studentEmail: ["studentemail", "studentemailid", "studentmail", "childemail", "pupilemail"],
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Strip spaces, dashes, slashes and dots: "VIII - A", "viii/a" and "VIII.A" all become "VIIIA".
export const sectionKey = (s: string) => s.toUpperCase().replace(/[\s\-_/.]+/g, "");

// Lookup from every accepted spelling of a section to its id: "VIII-A" and,
// for good measure, "8-A" (the class's number).
export function buildSectionLookup(sections: SectionRef[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sections) {
    map.set(sectionKey(`${s.className}${s.sectionName}`), s.id);
    const byLevel = sectionKey(`${s.classLevel}${s.sectionName}`);
    if (!map.has(byLevel)) map.set(byLevel, s.id);
  }
  return map;
}

// Read a date written as 2012-08-15, 15-08-2012, 15/08/2012 or 15.08.2012
// (day first, as written in India). Returns "YYYY-MM-DD", null when blank, or
// "bad" when it cannot be a real date of birth.
export function parseDate(raw: string): string | null | "bad" {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) { y = +match[1]; m = +match[2]; d = +match[3]; }
  else {
    match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return "bad";
    d = +match[1]; m = +match[2]; y = +match[3];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "bad";
  const now = new Date();
  if (y < 1980 || dt.getTime() > now.getTime()) return "bad";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseGender(raw: string): Gender | null | "bad" {
  const s = squash(raw);
  if (!s) return null;
  if (["m", "male", "boy", "b"].includes(s)) return "male";
  if (["f", "female", "girl", "g"].includes(s)) return "female";
  if (["o", "other", "others"].includes(s)) return "other";
  return "bad";
}

export function parseRoll(raw: string): number | null | "bad" {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d{1,4}$/.test(s)) return "bad";
  const n = Number(s);
  return n >= 1 && n <= 9999 ? n : "bad";
}

const PHONE_OK = /^[+\d][\d\s-]{6,19}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

// Check the add/edit form. Returns the first problem in plain words, or null.
// `limited` is the class teacher's form: no admission no or class-section.
export function checkStudentInput(v: StudentInput, limited = false): string | null {
  if (!tidy(v.fullName)) return "Please enter the student's full name.";
  if (!limited) {
    if (!tidy(v.admissionNo)) return "Please enter the admission number.";
    if (!v.sectionId) return "Please choose the class and section.";
  }
  if (v.dob && parseDate(v.dob) === "bad") return "The date of birth does not look right.";
  if (v.gender && !["male", "female", "other"].includes(v.gender)) return "Please choose a gender from the list.";
  if (v.rollNo && parseRoll(v.rollNo) === "bad") return "Roll no should be a whole number, like 12.";
  if (tidy(v.studentEmail) && !EMAIL_OK.test(tidy(v.studentEmail))) return "The student's email does not look right.";
  const g = v.guardian;
  const anyParent = tidy(g.fullName) || tidy(g.relation) || tidy(g.phone) || tidy(g.email);
  if (anyParent && !tidy(g.fullName)) return "Please enter the parent's name.";
  if (tidy(g.phone) && !PHONE_OK.test(tidy(g.phone))) return "The parent's phone number does not look right.";
  if (tidy(g.email) && !EMAIL_OK.test(tidy(g.email))) return "The parent's email does not look right.";
  return null;
}

// --- CSV --------------------------------------------------------------------

// Split CSV text into rows of cells. Handles quoted cells, commas and line
// breaks inside quotes, Windows line endings and Excel's leading BOM. A file
// saved with semicolons (some Excel setups) is read too.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// The template as CSV text.
export function templateCsv(): string {
  return `${TEMPLATE_HEADERS.join(",")}\r\n`;
}

export type ReadResult = { rows: ImportRow[]; problem: string | null };

// Turn the CSV's rows into checked student rows. `sections` decides which
// class-sections exist; duplicates are checked within the file.
export function readImport(cells: string[][], sections: SectionRef[]): ReadResult {
  const nonEmpty = cells.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { rows: [], problem: "The file is empty." };
  const header = nonEmpty[0].map(squash);
  const at: Partial<Record<Col, number>> = {};
  (Object.keys(HEADER_ALIASES) as Col[]).forEach((col) => {
    const idx = header.findIndex((h) => HEADER_ALIASES[col].includes(h));
    if (idx >= 0) at[col] = idx;
  });
  if (at.fullName === undefined || at.admissionNo === undefined || at.section === undefined) {
    return {
      rows: [],
      problem: "The first row must have the column names from the template. We need at least \"Full name\", \"Admission no\" and \"Class-section\".",
    };
  }
  const lookup = buildSectionLookup(sections);
  const seen = new Map<string, number>();
  const rows: ImportRow[] = [];
  // Line numbers count every line of the file, including blank ones, so the
  // office can find the row in Excel.
  let line = 0;
  for (const r of cells) {
    line++;
    if (line === 1 || !r.some((c) => c.trim() !== "")) continue;
    const get = (col: Col) => (at[col] === undefined ? "" : tidy(r[at[col]!]));
    const errors: string[] = [];
    const fullName = get("fullName");
    const admissionNo = get("admissionNo");
    if (!fullName) errors.push("Name is missing");
    if (!admissionNo) errors.push("Admission no is missing");
    else {
      const key = admissionNo.toUpperCase();
      const first = seen.get(key);
      if (first !== undefined) errors.push(`Admission no ${admissionNo} is already used on line ${first}`);
      else seen.set(key, line);
    }
    const sectionLabel = get("section");
    const sectionId = sectionLabel ? lookup.get(sectionKey(sectionLabel)) ?? null : null;
    if (!sectionLabel) errors.push("Class-section is missing");
    else if (!sectionId) errors.push(`No class-section called "${sectionLabel}"`);
    const dob = parseDate(get("dob"));
    if (dob === "bad") errors.push(`Date of birth "${get("dob")}" is not a real date`);
    const gender = parseGender(get("gender"));
    if (gender === "bad") errors.push(`Gender "${get("gender")}" should be Male, Female or Other`);
    const rollNo = parseRoll(get("rollNo"));
    if (rollNo === "bad") errors.push(`Roll no "${get("rollNo")}" should be a whole number`);
    const parentName = get("parentName");
    const phone = get("phone");
    const email = get("email");
    if (!parentName && (phone || email || get("relation"))) errors.push("Parent name is missing");
    if (phone && !PHONE_OK.test(phone)) errors.push(`Phone "${phone}" does not look right`);
    if (email && !EMAIL_OK.test(email)) errors.push(`Email "${email}" does not look right`);
    const studentEmail = get("studentEmail");
    if (studentEmail && !EMAIL_OK.test(studentEmail)) errors.push(`Student email "${studentEmail}" does not look right`);
    rows.push({
      line, fullName, admissionNo,
      dob: dob === "bad" ? null : dob,
      gender: gender === "bad" ? null : gender,
      sectionId, sectionLabel,
      rollNo: rollNo === "bad" ? null : rollNo,
      parentName, relation: get("relation"), phone, email, studentEmail,
      errors,
    });
  }
  if (!rows.length) return { rows: [], problem: "The file has the column names but no students under them." };
  return { rows, problem: null };
}
