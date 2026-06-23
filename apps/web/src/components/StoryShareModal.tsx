import React from "react";
import { X, Download, Copy, CheckCheck, Share2, HelpCircle } from "lucide-react";
import { copyElementAsImageToClipboard, downloadElementAsImage, type StoryCopyResult } from "../lib/storyShare";
import {
  LAYOUT_OPTIONS,
  STORY_H,
  STORY_W,
  StoryStatsCard,
  type StoryCardProps,
  type StoryShareLayout
} from "../lib/storyShareLayouts";

export type { StoryShareLayout };

interface StoryShareModalProps extends StoryCardProps {
  onClose: () => void;
}

export { StoryStatsCard };

export function StoryShareModal({ onClose, layout: initialLayout = "overlay-hero", ...cardProps }: StoryShareModalProps) {
  const [layout, setLayout] = React.useState<StoryShareLayout>(initialLayout);
  const [isCopying, setIsCopying] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [copyResult, setCopyResult] = React.useState<StoryCopyResult | null>(null);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const captureRef = React.useRef<HTMLDivElement>(null);
  const [viewportH, setViewportH] = React.useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));

  React.useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const dockClearance = 112;
  const modalMaxH = Math.max(360, viewportH - dockClearance - 24);
  const previewBudget = Math.min(280, modalMaxH * 0.34);
  const scale = Math.min(1, previewBudget / STORY_H);

  const activeLayout = LAYOUT_OPTIONS.find((option) => option.id === layout);
  const filename = `haff-picklepulse-${cardProps.playerName.toLowerCase().replace(/\s+/g, "-")}.png`;

  const handleCopy = async () => {
    if (!captureRef.current) return;
    setIsCopying(true);
    setCopyResult(null);
    setCopyError(null);
    try {
      const result = await copyElementAsImageToClipboard(captureRef.current, filename, 2, {
        backgroundColor: null
      });
      setCopyResult(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setCopyError("Share cancelled.");
      } else {
        setCopyError("Could not copy — try Download instead.");
      }
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      await downloadElementAsImage(captureRef.current, filename, 2, { backgroundColor: null });
    } finally {
      setIsDownloading(false);
    }
  };

  const copyMessage =
    copyResult === "copied"
      ? "Transparent story copied! Open Instagram Stories, add your photo, then paste as a sticker."
      : copyResult === "shared"
        ? "Share sheet opened — tap Save Image, then add it as a sticker in Instagram Stories."
        : copyResult === "downloaded"
          ? "Transparent PNG saved! Add it as a sticker over your story photo in Instagram."
          : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[250] flex items-end justify-center bg-black/85 px-3 pt-3 backdrop-blur-sm sm:items-center sm:p-4"
        style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#060f0a] p-4 shadow-2xl overflow-y-auto sm:p-6"
          style={{ maxHeight: modalMaxH }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Share2 size={20} className="text-[#2ee882]" />
              <span className="text-base font-black uppercase tracking-widest text-ivory">Share Story</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelp(true)}
                className="rounded-full bg-white/10 p-2 text-ivory/60 hover:text-ivory hover:bg-white/15 transition"
                type="button"
                title="How to share"
              >
                <HelpCircle size={16} />
              </button>
              <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-ivory/60 hover:text-ivory hover:bg-white/15 transition" type="button">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-5 gap-1.5 rounded-2xl bg-white/[0.03] p-2 border border-white/10 backdrop-blur-md">
            {LAYOUT_OPTIONS.map((option) => {
              const isActive = layout === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLayout(option.id)}
                  className={`relative rounded-xl py-2.5 px-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-br from-[#2ee882] to-[#15803d] text-[#020f0a] shadow-[0_0_15px_rgba(46,232,130,0.35)] border border-[#2ee882]/30 scale-[1.02]"
                      : "bg-white/[0.02] border border-white/5 text-ivory/60 hover:text-ivory hover:bg-white/[0.08] hover:border-white/10"
                  }`}
                >
                  {option.label}
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_#fff]" />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="flex justify-center mb-4 min-h-0 shrink rounded-xl overflow-hidden"
            style={{
              height: Math.max(160, STORY_H * scale),
              background: "repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px"
            }}
          >
            <div
              style={{
                width: STORY_W,
                transform: `scale(${scale})`,
                transformOrigin: "top center",
                flexShrink: 0
              }}
            >
              <StoryStatsCard layout={layout} {...cardProps} />
            </div>
          </div>

          <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}>
            <StoryStatsCard ref={captureRef} layout={layout} {...cardProps} />
          </div>

          {copyMessage && (
            <div
              className={`mb-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-center ${
                copyResult === "downloaded"
                  ? "bg-amber-400/15 text-amber-300 border border-amber-400/25"
                  : "bg-[#2ee882]/15 text-[#2ee882] border border-[#2ee882]/25"
              }`}
            >
              {copyMessage}
            </div>
          )}

          {copyError && (
            <div className="mb-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-center bg-red-500/15 text-red-300 border border-red-500/25">
              {copyError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isCopying}
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#2ee882] py-3.5 text-sm font-black text-[#020f0a] hover:bg-[#4dea96] disabled:opacity-50 transition"
            >
              {copyResult === "copied" || copyResult === "shared" ? <CheckCheck size={18} /> : <Copy size={18} />}
              {isCopying ? "Generating…" : "Copy Image"}
            </button>
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3.5 text-sm font-black text-ivory hover:bg-white/15 disabled:opacity-50 transition"
            >
              <Download size={18} />
              {isDownloading ? "Saving…" : "Download"}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] leading-relaxed text-ivory/45">
            {activeLayout?.hint ?? "1080×1920 transparent overlay — uses your live player statistics."}
          </p>
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/90 px-4 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#060f0a] p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle size={20} className="text-[#2ee882]" />
                <span className="text-base font-black uppercase tracking-widest text-ivory">How to Share</span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="rounded-full bg-white/10 p-2 text-ivory/60 hover:text-ivory transition"
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-sm text-ivory/80">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">1</div>
                  <h3 className="font-bold text-ivory">Pick a layout</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Choose from <strong>10 transparent 1080×1920</strong> overlays. Text uses drop shadows so it reads on any photo.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">2</div>
                  <h3 className="font-bold text-ivory">Copy or Download</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  On iPhone, <strong>Copy Image</strong> may open the share sheet — tap <strong>Save Image</strong>, then add it as a sticker in Instagram Stories.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">3</div>
                  <h3 className="font-bold text-ivory">Post on Instagram Stories</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Open Instagram Stories, pick or take a photo, then add the PNG as a sticker. Position and resize as you like.
                </p>
              </div>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-[#2ee882]/10 border border-[#2ee882]/20">
              <p className="text-xs text-[#2ee882] text-center font-semibold">
                Tag <strong>@haffleisureclub</strong> and use <strong>#PicklePulse</strong> when you share!
              </p>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full mt-4 rounded-xl bg-white/10 py-3 text-sm font-black text-ivory hover:bg-white/15 transition"
              type="button"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
