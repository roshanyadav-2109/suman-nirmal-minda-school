"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/empty";

// Shown when a page fails to load. A dropped connection is by far the commonest
// cause in a school, so that case gets its own picture and wording.
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  // Read once on mount: a page that errored while the device was offline
  // should say so, rather than blame the site.
  const [offline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <Illustration name={offline ? "network-bad" : "error"} size={170} className="mb-5" />
      <h2 className="t-h2 text-ink-900">{offline ? "You're offline" : "Something went wrong"}</h2>
      <p className="mt-1 max-w-md text-[14px] text-ink-500">
        {offline
          ? "Check the Wi-Fi or mobile data, then try again."
          : "This page didn't load properly. Please try again in a moment."}
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="subtle" onClick={() => (window.location.href = "/")}>Dashboard</Button>
      </div>
    </div>
  );
}
