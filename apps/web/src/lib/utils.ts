import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    theme: {
      colors: ["forest", "ivy", "ivory", "linen", "brass", "clay", "ink"]
    }
  }
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
