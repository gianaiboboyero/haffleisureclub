import * as React from "react";
import { cn } from "../lib/utils";

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ivory px-5 text-sm font-semibold text-forest shadow-[0_14px_38px_rgba(0,0,0,0.18)] transition hover:bg-linen active:scale-[0.98] disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("club-panel rounded-xl p-4", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full bg-ivory/90 px-3 py-1 text-xs font-semibold text-forest shadow-sm", className)}
      {...props}
    />
  );
}
