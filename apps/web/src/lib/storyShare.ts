import { toPng } from "html-to-image";

/**
 * Renders `element` as a high-resolution PNG and copies it to the clipboard.
 * Returns `"copied"` on success or `"downloaded"` when the Clipboard API is not
 * available (in which case the PNG is automatically downloaded as a fallback).
 */
export async function copyElementAsImageToClipboard(
  element: HTMLElement,
  filename = "haff-picklepulse-story.png",
  pixelRatio = 2,
  options?: { backgroundColor?: string | null }
): Promise<"copied" | "downloaded"> {
  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: options?.backgroundColor ?? undefined,
  });

  const clipboardSupported =
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function";

  if (clipboardSupported) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  }

  triggerDownload(dataUrl, filename);
  return "downloaded";
}

/**
 * Renders `element` as a PNG and downloads it.
 */
export async function downloadElementAsImage(
  element: HTMLElement,
  filename = "haff-picklepulse-story.png",
  pixelRatio = 2,
  options?: { backgroundColor?: string | null }
): Promise<void> {
  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: options?.backgroundColor ?? undefined,
  });
  triggerDownload(dataUrl, filename);
}

function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
