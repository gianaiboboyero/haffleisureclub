export function RouteSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4 px-4 py-8" aria-label="Loading page">
      <div className="h-10 w-56 rounded-xl bg-ivory/10" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-40 rounded-2xl bg-ivory/[0.06]" />)}
      </div>
    </div>
  );
}
