import { toPng } from "html-to-image";

/**
 * Convert an image URL to a data URL to avoid CORS issues during capture.
 */
async function imageUrlToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // Fallback to original URL if conversion fails
  }
}

/**
 * Pre-load and convert all images in the element to data URLs to ensure they render.
 */
async function prepareImagesForCapture(element: HTMLElement): Promise<void> {
  const images = element.querySelectorAll("img");
  const promises = Array.from(images).map(async (img) => {
    if (img.src && !img.src.startsWith("data:")) {
      try {
        const dataUrl = await imageUrlToDataUrl(img.src);
        img.src = dataUrl;
      } catch (err) {
        console.warn("Failed to convert image:", err);
      }
    }
  });
  await Promise.all(promises);
}

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
  // Pre-load images to avoid CORS issues
  await prepareImagesForCapture(element);
  
  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: options?.backgroundColor ?? undefined,
    skipFonts: false,
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
  // Pre-load images to avoid CORS issues
  await prepareImagesForCapture(element);
  
  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: options?.backgroundColor ?? undefined,
    skipFonts: false,
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
