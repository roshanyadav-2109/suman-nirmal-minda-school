// Shown the moment someone opens a page, while it loads: "Loading" with three
// dots pulsing in turn. Motion stops for anyone who has asked their device for
// reduced motion (globals.css).
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex items-center gap-2 text-[15px] font-medium text-ink-700">
        Loading
        <span className="flex gap-1" aria-hidden>
          <span className="loader-dot" />
          <span className="loader-dot [animation-delay:0.15s]" />
          <span className="loader-dot [animation-delay:0.3s]" />
        </span>
      </div>
    </div>
  );
}
