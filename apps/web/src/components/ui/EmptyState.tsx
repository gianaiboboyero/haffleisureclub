import type React from "react";

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ivory/15 bg-ivory/[0.035] px-6 py-10 text-center">
      <h3 className="font-display text-xl font-black text-ivory">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ivory/55">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
