// Public Supabase connection details.
//
// The project URL and the anon key are browser-safe by design — they are shipped
// to every visitor, and Row Level Security, not secrecy, is the boundary. They are
// baked in as defaults so a fresh clone or a fresh deployment connects to the same
// backend with nothing configured; set the env vars to point a deployment at a
// different Supabase project.
//
// The service-role key is a different matter entirely: server-only, never here.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://gvfudrhdowlwvpbtctsl.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZnVkcmhkb3dsd3ZwYnRjdHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjI4OTgsImV4cCI6MjEwMzg5ODg5OH0.jIrSZyzyFZqyjN1u3f73Fh558Et5sh-hB0K5MAKNXSk";
