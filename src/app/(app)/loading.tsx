// Instant navigation feedback while the server renders the next page.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-24 rounded bg-panel" />
        <div className="mt-2 h-7 w-64 rounded bg-panel" />
        <div className="mt-2 h-4 w-80 rounded bg-panel" />
      </div>
      <div className="mb-5 h-16 rounded-md border border-hair bg-panel/50" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-md border border-hair bg-panel/50" />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-64 rounded-md border border-hair bg-panel/50" />
        ))}
      </div>
    </div>
  );
}
