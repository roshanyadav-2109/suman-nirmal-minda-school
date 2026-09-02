import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { RiderAdmin } from "@/components/transport/rider-admin";
import { getRiderAdmin } from "@/lib/data/transport";
import { numParam, strParam } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function TransportRidersPage({ searchParams }: { searchParams: SP }) {
  const session = (await getSession())!;
  // RLS already refuses the writes; this redirect only keeps other staff off a
  // screen where every button would fail.
  if (!session.isAdminScope) redirect("/transport");

  const sp = await searchParams;
  const { t } = await getT();
  const data = await getRiderAdmin({
    q: strParam(sp.q) ?? undefined,
    routeId: numParam(sp.route),
    page: numParam(sp.page) ?? 0,
    unassignedPage: numParam(sp.upage) ?? 0,
  });

  return (
    <div>
      <PageHeader title={t("transport.riderAdmin")} description={t("transport.riderAdminIntro")} />
      <RiderAdmin data={data} />
    </div>
  );
}
