import React from "react";

export function Surface({
  level = "panel",
  className = "",
  children
}: {
  level?: "canvas" | "panel" | "overlay";
  className?: string;
  children: React.ReactNode;
}) {
  const levels = {
    canvas: "bg-[#061f18]",
    panel: "border border-ivory/10 bg-ivory/[0.055]",
    overlay: "border border-ivory/15 bg-[#173f32]/95 shadow-2xl backdrop-blur-xl"
  };
  return <div className={`${levels[level]} ${className}`}>{children}</div>;
}
