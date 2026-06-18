export const PROFILE_PHOTO_CROP_SIZE = 280;
export const PROFILE_PHOTO_OUTPUT_SIZE = 640;
export const PROFILE_AVATAR_OUTPUT_SIZE = 256;

export type CropTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  baseScale: number;
};

export function validateProfileImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 8 MB.");
  }
}

export async function readProfileImageFile(file: File) {
  validateProfileImageFile(file);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function loadProfileImage(source: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be opened."));
    image.src = source;
  });
}

export function getProfilePhotoBaseScale(image: HTMLImageElement, cropSize = PROFILE_PHOTO_CROP_SIZE) {
  return Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight);
}

export function getInitialCropOffset(
  image: HTMLImageElement,
  baseScale: number,
  zoom: number,
  cropSize = PROFILE_PHOTO_CROP_SIZE
) {
  const width = image.naturalWidth * baseScale * zoom;
  const height = image.naturalHeight * baseScale * zoom;
  return {
    x: (cropSize - width) / 2,
    y: (cropSize - height) / 2
  };
}

export function clampCropOffset(
  offset: { x: number; y: number },
  image: HTMLImageElement,
  baseScale: number,
  zoom: number,
  cropSize = PROFILE_PHOTO_CROP_SIZE
) {
  const width = image.naturalWidth * baseScale * zoom;
  const height = image.naturalHeight * baseScale * zoom;
  const minX = Math.min(0, cropSize - width);
  const minY = Math.min(0, cropSize - height);
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y))
  };
}

export function exportCroppedProfilePhoto(
  image: HTMLImageElement,
  transform: CropTransform,
  cropSize = PROFILE_PHOTO_CROP_SIZE,
  outputSize = PROFILE_PHOTO_OUTPUT_SIZE
) {
  const scale = transform.baseScale * transform.zoom;
  const sourceX = Math.max(0, -transform.offsetX / scale);
  const sourceY = Math.max(0, -transform.offsetY / scale);
  const sourceSize = cropSize / scale;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable.");

  const maxX = Math.max(0, image.naturalWidth - sourceSize);
  const maxY = Math.max(0, image.naturalHeight - sourceSize);
  context.drawImage(
    image,
    Math.min(sourceX, maxX),
    Math.min(sourceY, maxY),
    Math.min(sourceSize, image.naturalWidth),
    Math.min(sourceSize, image.naturalHeight),
    0,
    0,
    outputSize,
    outputSize
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Export cropped square avatar as WebP blob (optimized for Supabase Storage). */
export function exportCroppedProfilePhotoWebP(
  image: HTMLImageElement,
  transform: CropTransform,
  cropSize = PROFILE_PHOTO_CROP_SIZE,
  outputSize = PROFILE_AVATAR_OUTPUT_SIZE
): Promise<Blob> {
  const scale = transform.baseScale * transform.zoom;
  const sourceX = Math.max(0, -transform.offsetX / scale);
  const sourceY = Math.max(0, -transform.offsetY / scale);
  const sourceSize = cropSize / scale;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Photo processing is unavailable."));

  const maxX = Math.max(0, image.naturalWidth - sourceSize);
  const maxY = Math.max(0, image.naturalHeight - sourceSize);
  context.drawImage(
    image,
    Math.min(sourceX, maxX),
    Math.min(sourceY, maxY),
    Math.min(sourceSize, image.naturalWidth),
    Math.min(sourceSize, image.naturalHeight),
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode WebP image."))),
      "image/webp",
      0.82
    );
  });
}

export async function dataUrlToWebpBlob(dataUrl: string, outputSize = PROFILE_AVATAR_OUTPUT_SIZE): Promise<Blob> {
  const image = await loadProfileImage(dataUrl);
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - crop) / 2;
  const sy = (image.naturalHeight - crop) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Photo processing is unavailable.");
  ctx.drawImage(image, sx, sy, crop, crop, 0, 0, outputSize, outputSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode WebP image."))),
      "image/webp",
      0.82
    );
  });
}

export function isInlineAvatarData(value?: string | null) {
  return Boolean(value?.startsWith("data:image"));
}

/** Center-crop fallback when no interactive crop is used. */
export async function prepareProfileImage(file: File) {
  const source = await readProfileImageFile(file);
  const image = await loadProfileImage(source);
  const baseScale = getProfilePhotoBaseScale(image);
  const offset = getInitialCropOffset(image, baseScale, 1);
  return exportCroppedProfilePhoto(image, {
    zoom: 1,
    offsetX: offset.x,
    offsetY: offset.y,
    baseScale
  });
}
