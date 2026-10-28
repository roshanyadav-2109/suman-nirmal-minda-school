"use client";
import { useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/field";
import { useNavigate } from "@/components/nav-progress";

export function DateParam({ date }: { date: string }) {
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Input
      type="date"
      value={date}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("date", e.target.value);
        navigate(`${pathname}?${next.toString()}`);
      }}
    />
  );
}
