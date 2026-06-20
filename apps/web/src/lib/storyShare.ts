import { toPng } from "html-to-image";

export type StoryCopyResult = "copied" | "downloaded" | "shared";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function canClipboardWriteImages() {
  return (
    typeof ClipboardItem !== "undefined"
    && typeof navigator.clipboard?.write === "function"
    && window.isSecureContext
  );
}

async function writeImageBlobToClipboard(blob: Blob): Promise<void> {
  const pngBlob = blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": Promise.resolve(pngBlob)
    })
  ]);
}

async function shareImageBlob(blob: Blob, filename: string): Promise<boolean> {
  if (typeof navigator.share !== "function" || typeof File === "undefined") return false;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
  await navigator.share({ files: [file], title: filename });
  return true;
}

/**
 * Convert an image URL to a data URL to avoid CORS issues during capture.
 */
async function imageUrlToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function prepareImagesForCapture(element: HTMLElement): Promise<void> {
  const images = element.querySelectorAll("img");
  await Promise.all(
    Array.from(images).map(async (img) => {
      if (img.src && !img.src.startsWith("data:")) {
        try {
          img.src = await imageUrlToDataUrl(img.src);
        } catch (err) {
          console.warn("Failed to convert image:", err);
        }
      }
    })
  );
}

async function renderElementToPngBlob(
  element: HTMLElement,
  pixelRatio = 2,
  options?: { backgroundColor?: string | null }
): Promise<Blob> {
  await prepareImagesForCapture(element);
  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: options?.backgroundColor ?? undefined,
    skipFonts: false
  });
  return dataUrlToBlob(dataUrl);
}

function triggerDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDownload(dataUrl: string, filename: string) {
  triggerDownloadBlob(dataUrlToBlob(dataUrl), filename);
}

/**
 * Renders `element` as PNG and copies to clipboard when supported.
 * On iOS, falls back to the native share sheet (Save Image) then download.
 */
export async function copyElementAsImageToClipboard(
  element: HTMLElement,
  filename = "haff-picklepulse-story.png",
  pixelRatio = 2,
  options?: { backgroundColor?: string | null }
): Promise<StoryCopyResult> {
  const blob = await renderElementToPngBlob(element, pixelRatio, options);

  if (canClipboardWriteImages()) {
    try {
      await writeImageBlobToClipboard(blob);
      return "copied";
    } catch (err) {
      console.warn("Clipboard image write failed:", err);
    }
  }

  if (isIOSDevice()) {
    try {
      const shared = await shareImageBlob(blob, filename);
      if (shared) return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      console.warn("Share sheet failed:", err);
    }
  }

  triggerDownloadBlob(blob, filename);
  return "downloaded";
}

export async function downloadElementAsImage(
  element: HTMLElement,
  filename = "haff-picklepulse-story.png",
  pixelRatio = 2,
  options?: { backgroundColor?: string | null }
): Promise<void> {
  const blob = await renderElementToPngBlob(element, pixelRatio, options);
  triggerDownloadBlob(blob, filename);
}

export { triggerDownload };
