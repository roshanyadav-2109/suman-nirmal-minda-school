import Link from "next/link";
import { Illustration } from "@/components/ui/empty";

// Any address that does not match a page.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-4 text-center">
      <Illustration name="not-found" size={180} className="mb-5" />
      <h1 className="t-h2 text-ink-900">Page not found</h1>
      <p className="mt-1 max-w-md text-[14px] text-ink-500">
        This address doesn&apos;t lead to a page in the school portal. It may have been typed wrongly or moved.
      </p>
      <Link
        prefetch={false}
        href="/"
        className="mt-5 inline-flex h-10 items-center rounded-sm bg-[#0F6CBD] px-5 text-[14px] font-medium text-white hover:bg-[#115EA3]"
      >
        Go to the Dashboard
      </Link>
    </div>
  );
}
