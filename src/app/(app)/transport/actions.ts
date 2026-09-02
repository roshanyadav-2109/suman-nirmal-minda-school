"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentYear } from "@/lib/session";

// Allotting a pupil to a bus is office work. Nothing here checks the caller's
// role in JS: the write is attempted and RLS (stransport_write, admin scope
// only) decides. A refusal comes back as a message key the UI translates, so
// no English lives in this file.

export type TransportErrorKey =
  | "transport.noYear"
  | "transport.notAllowed"
  | "transport.stopNotOnRoute"
  | "transport.saveFailed";

export type TransportResult =
  | { ok: true; id: number }
  | { ok: false; key: TransportErrorKey; error: string };

const fail = (key: TransportErrorKey, error = ""): TransportResult => ({ ok: false, key, error });

// A stop belongs to exactly one route, so a pickup or drop from another route
// would leave the family watching a bus that never comes. The DB cannot see
// this (route_stop is referenced, not constrained to the row's route).
async function stopsBelong(routeId: number, stopIds: number[]) {
  const supabase = await createClient();
  const wanted = [...new Set(stopIds)];
  const { data } = await supabase
    .from("route_stop")
    .select("id")
    .eq("route_id", routeId)
    .in("id", wanted);
  return (data ?? []).length === wanted.length;
}

/** Put a pupil on a bus for the current year, or move them if already allotted. */
export async function assignTransport(input: {
  studentId: number;
  routeId: number;
  pickupStopId: number;
  dropStopId: number;
}): Promise<TransportResult> {
  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) return fail("transport.noYear");

  if (!(await stopsBelong(input.routeId, [input.pickupStopId, input.dropStopId]))) {
    return fail("transport.stopNotOnRoute");
  }

  // One arrangement per pupil per year (unique student_id + academic_year_id),
  // so re-allotting a pupil the office had removed revives that same row.
  const { data, error } = await supabase
    .from("student_transport")
    .upsert(
      {
        student_id: input.studentId,
        academic_year_id: year.id,
        route_id: input.routeId,
        pickup_stop_id: input.pickupStopId,
        drop_stop_id: input.dropStopId,
        is_active: true,
      },
      { onConflict: "student_id,academic_year_id" },
    )
    .select("id")
    .maybeSingle();

  if (error) return fail(rlsKey(error.code), error.message);
  if (!data) return fail("transport.notAllowed");
  revalidateTransport();
  return { ok: true, id: data.id };
}

/** Move an existing rider to another route or stop. */
export async function updateTransport(input: {
  id: number;
  routeId: number;
  pickupStopId: number;
  dropStopId: number;
}): Promise<TransportResult> {
  const supabase = await createClient();

  if (!(await stopsBelong(input.routeId, [input.pickupStopId, input.dropStopId]))) {
    return fail("transport.stopNotOnRoute");
  }

  const { data, error } = await supabase
    .from("student_transport")
    .update({
      route_id: input.routeId,
      pickup_stop_id: input.pickupStopId,
      drop_stop_id: input.dropStopId,
      is_active: true,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error) return fail(rlsKey(error.code), error.message);
  // An update RLS refuses matches no rows and raises nothing, so an empty
  // result is the refusal, not a missing row.
  if (!data) return fail("transport.notAllowed");
  revalidateTransport();
  return { ok: true, id: input.id };
}

/** Take a pupil off the bus. Deactivated, never deleted, so history survives. */
export async function removeTransport(input: { id: number }): Promise<TransportResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_transport")
    .update({ is_active: false })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error) return fail(rlsKey(error.code), error.message);
  if (!data) return fail("transport.notAllowed");
  revalidateTransport();
  return { ok: true, id: input.id };
}

// 42501 is Postgres's insufficient_privilege — what an RLS refusal looks like
// on insert; anything else is a genuine save failure worth the generic message.
function rlsKey(code: string | undefined): TransportErrorKey {
  return code === "42501" ? "transport.notAllowed" : "transport.saveFailed";
}

function revalidateTransport() {
  revalidatePath("/transport");
  revalidatePath("/transport/riders");
}
