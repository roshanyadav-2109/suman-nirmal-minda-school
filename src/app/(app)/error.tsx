"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/icons";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-down-soft text-down">
        <AlertIcon size={22} />
      </div>
      <h2 className="t-h2 text-ink-900">Something went wrong</h2>
      <p className="mt-1 max-w-md text-[14px] text-ink-500">
        This page hit an unexpected error. You can retry, or head back to the dashboard.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="subtle" onClick={() => (window.location.href = "/")}>Dashboard</Button>
      </div>
    </div>
  );
}
