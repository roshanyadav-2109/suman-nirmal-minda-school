import Link from "next/link";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { searchEverything } from "@/lib/data/search";
import { strParam } from "@/lib/utils";
import { guardTab } from "@/lib/access";

type SP = Promise<Record<string, string | string[] | undefined>>;

// Full results for a top-bar search: every group, more hits per group.
export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const denied = await guardTab("/dashboard/search");
  if (denied) return denied;
  const sp = await searchParams;
  const { t } = await getT();
  const q = (strParam(sp.q) ?? "").trim();
  const groups = q.length >= 2 ? await searchEverything(q, 40) : [];

  return (
    <div>
      <PageHeader title={t("x.searchTitle")} description={q ? t("x.searchResults", { q }) : undefined} />
      {groups.length === 0 ? (
        <EmptyState art="no-results" title={t("transport.noResults")} hint={q ? t("x.searchNothing", { q }) : undefined} />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key}>
              <CardHeader title={`${g.label} (${g.hits.length})`} />
              <CardBody className="p-0">
                <ul className="divide-y divide-hair">
                  {g.hits.map((h, i) => (
                    <li key={i}>
                      {h.href ? (
                        <Link prefetch={false} href={h.href} className="block px-4 py-2.5 hover:bg-[#F5F9FE]">
                          <span className="block text-[14px] font-medium text-[#0F6CBD]">{h.title}</span>
                          {h.detail && <span className="block text-[13px] text-ink-500">{h.detail}</span>}
                        </Link>
                      ) : (
                        <div className="px-4 py-2.5">
                          <span className="block text-[14px] font-medium text-ink-900">{h.title}</span>
                          {h.detail && <span className="block text-[13px] text-ink-500">{h.detail}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
