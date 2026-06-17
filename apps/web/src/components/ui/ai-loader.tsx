import React from "react";
import { cn } from "../../lib/utils";

export function AiLoader({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex min-h-[calc(100dvh-5rem)] items-center justify-center px-6 text-ivory", className)} role="status" aria-label="Loading">
      <div className="absolute inset-0 texture pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff8ea0c_1px,transparent_1px),linear-gradient(to_bottom,#fff8ea0c_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,93,0.18),transparent_50%),radial-gradient(circle_at_100%_40%,rgba(127,182,154,0.15),transparent_40%),linear-gradient(180deg,rgba(14,90,67,0.1),rgba(6,36,27,0.9))] pointer-events-none" />
      <div className="loader-wrapper relative z-10">
        {"loadink".split("").map((letter, index) => (
          <span className="loader-letter" style={{ animationDelay: `${index * 0.05}s` }} key={`${letter}-${index}`}>
            {letter}
          </span>
        ))}
        <div className="loader" aria-hidden="true" />
      </div>
    </div>
  );
}

export const Component = AiLoader;
