import React from "react";
import { Crop, X, ZoomIn } from "lucide-react";
import {
  clampCropOffset,
  exportCroppedProfilePhoto,
  exportCroppedProfilePhotoWebP,
  getInitialCropOffset,
  getProfilePhotoBaseScale,
  loadProfileImage,
  PROFILE_AVATAR_OUTPUT_SIZE,
  PROFILE_PHOTO_CROP_SIZE,
} from "../lib/profilePhoto";

type ProfilePhotoCropperProps = {
  imageSrc: string;
  title?: string;
  /** When true, returns WebP blob via onCompleteBlob (for Supabase upload). */
  webpOutput?: boolean;
  onCancel: () => void;
  onComplete: (dataUrl: string) => void;
  onCompleteBlob?: (blob: Blob) => void;
};

export function ProfilePhotoCropper({
  imageSrc,
  title = "Crop profile photo",
  webpOutput = false,
  onCancel,
  onComplete,
  onCompleteBlob
}: ProfilePhotoCropperProps) {
  const cropSize = PROFILE_PHOTO_CROP_SIZE;
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isExporting, setIsExporting] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const dragRef = React.useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  React.useEffect(() => {
    let active = true;
    void loadProfileImage(imageSrc)
      .then((loaded) => {
        if (!active) return;
        const baseScale = getProfilePhotoBaseScale(loaded);
        setImage(loaded);
        setZoom(1);
        setOffset(getInitialCropOffset(loaded, baseScale, 1, cropSize));
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "The image could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [imageSrc, cropSize]);

  const baseScale = image ? getProfilePhotoBaseScale(image, cropSize) : 1;
  const displayWidth = image ? image.naturalWidth * baseScale * zoom : 0;
  const displayHeight = image ? image.naturalHeight * baseScale * zoom : 0;

  const updateOffset = React.useCallback((next: { x: number; y: number }) => {
    if (!image) return;
    setOffset(clampCropOffset(next, image, baseScale, zoom, cropSize));
  }, [image, baseScale, zoom, cropSize]);

  const handleZoomChange = (nextZoom: number) => {
    if (!image) return;
    const clampedZoom = Math.min(3, Math.max(1, nextZoom));
    const centerX = cropSize / 2;
    const centerY = cropSize / 2;
    const imageX = (centerX - offset.x) / zoom;
    const imageY = (centerY - offset.y) / zoom;
    const nextOffset = {
      x: centerX - imageX * clampedZoom,
      y: centerY - imageY * clampedZoom
    };
    setZoom(clampedZoom);
    setOffset(clampCropOffset(nextOffset, image, baseScale, clampedZoom, cropSize));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY)
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleConfirm = async () => {
    if (!image) return;
    setIsExporting(true);
    try {
      const transform = {
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        baseScale
      };
      if (webpOutput && onCompleteBlob) {
        const blob = await exportCroppedProfilePhotoWebP(image, transform, cropSize, PROFILE_AVATAR_OUTPUT_SIZE);
        onCompleteBlob(blob);
      } else {
        const dataUrl = exportCroppedProfilePhoto(image, transform, cropSize);
        onComplete(dataUrl);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#041610]/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-ivory/10 bg-[#0b2f24] shadow-2xl">
        <div className="flex items-center justify-between border-b border-ivory/10 px-4 py-3">
          <div className="flex items-center gap-2 text-brass">
            <Crop size={16} />
            <p className="text-sm font-black uppercase tracking-wider text-ivory">{title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-ivory/60 transition hover:bg-ivory/10 hover:text-ivory"
            aria-label="Close cropper"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          {loadError ? (
            <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200">{loadError}</p>
          ) : (
            <>
              <div
                className="relative mx-auto touch-none overflow-hidden rounded-2xl border border-brass/30 bg-[#051812] shadow-inner"
                style={{ width: cropSize, height: cropSize }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {image && (
                  <img
                    alt=""
                    draggable={false}
                    src={imageSrc}
                    className="absolute left-0 top-0 max-w-none select-none"
                    style={{
                      width: displayWidth,
                      height: displayHeight,
                      transform: `translate(${offset.x}px, ${offset.y}px)`
                    }}
                  />
                )}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brass/80 ring-offset-2 ring-offset-[#051812]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/35 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/35 to-transparent" />
              </div>

              <p className="mt-3 text-center text-[11px] font-semibold text-linen/65">
                Drag to reposition. Pinch or use the slider to zoom.
              </p>

              <label className="mt-4 flex items-center gap-3">
                <ZoomIn size={14} className="shrink-0 text-brass" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  className="h-1.5 w-full cursor-pointer accent-brass"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-ivory/10 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl border border-ivory/15 bg-ivory/5 text-xs font-black uppercase tracking-wider text-ivory/80 transition hover:bg-ivory/10"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!image || Boolean(loadError) || isExporting}
            onClick={() => void handleConfirm()}
            className="min-h-11 flex-1 rounded-xl bg-brass text-xs font-black uppercase tracking-wider text-forest transition hover:bg-linen disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? "Saving..." : "Use Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
