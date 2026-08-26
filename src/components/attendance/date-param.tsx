"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/field";

export function DateParam({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Input
      type="date"
      value={date}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("date", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
    />
  );
}
