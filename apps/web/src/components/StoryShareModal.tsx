import React from "react";
import { X, Download, Copy, CheckCheck, Share2, HelpCircle } from "lucide-react";
import type { PlayerGameStats } from "../lib/playerStats";
import { formatMinutesPlayed } from "../lib/playerStats";
import { copyElementAsImageToClipboard, downloadElementAsImage } from "../lib/storyShare";

export type StoryShareLayout = "overlay-hero" | "overlay-stats";

const STORY_W = 1080;
const STORY_H = 1920;

const LAYOUT_OPTIONS: Array<{ id: StoryShareLayout; label: string; hint: string }> = [
  { id: "overlay-hero", label: "Hero", hint: "Transparent 9:16 — big court time, drop-shadow text" },
  { id: "overlay-stats", label: "Stats", hint: "Transparent 9:16 — full stat stack, drop-shadow text" },
];

const TEXT_SHADOW =
  "0 2px 6px rgba(0,0,0,0.92), 0 4px 18px rgba(0,0,0,0.78), 0 1px 0 rgba(0,0,0,1)";
const TEXT_SHADOW_HEAVY =
  "0 3px 10px rgba(0,0,0,0.95), 0 6px 28px rgba(0,0,0,0.82), 0 1px 2px rgba(0,0,0,1)";
const LABEL_SHADOW = "0 1px 4px rgba(0,0,0,0.88), 0 2px 12px rgba(0,0,0,0.65)";

const IVORY = "#f4f1e8";
const ACCENT = "#2ee882";
const BRASS = "#d4a843";

interface StoryCardProps {
  playerName: string;
  skillLevel: string;
  avatarUrl?: string;
  totalDaysPlayed: number;
  lastPlayedDate?: string;
  totalGamesPlayed: number;
  stats: PlayerGameStats;
  layout?: StoryShareLayout;
  cardRef?: React.Ref<HTMLDivElement>;
}

interface StoryShareModalProps extends StoryCardProps {
  onClose: () => void;
}

function storyCanvasStyle(): React.CSSProperties {
  return {
    width: STORY_W,
    height: STORY_H,
    background: "transparent",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    color: IVORY,
    boxSizing: "border-box",
  };
}

export const StoryStatsCard = React.forwardRef<HTMLDivElement, StoryCardProps>(
  function StoryStatsCard(
    {
      playerName,
      skillLevel,
      totalDaysPlayed,
      totalGamesPlayed,
      lastPlayedDate,
      stats,
      layout = "overlay-hero",
    },
    ref
  ) {
    const lastPlay = lastPlayedDate
      ? new Date(lastPlayedDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      : "—";
    const minutesLabel = formatMinutesPlayed(stats.minutesPlayed);
    const favCourtLabel = stats.favCourt?.name ?? "—";

    if (layout === "overlay-stats") {
      const statLines = [
        { label: "Games", value: String(totalGamesPlayed) },
        { label: "Court Time", value: minutesLabel },
        { label: "Visits", value: String(totalDaysPlayed) },
        { label: "Favorite Court", value: favCourtLabel },
      ];

      return (
        <div ref={ref} style={storyCanvasStyle()}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "220px 72px 280px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: ACCENT,
                textShadow: LABEL_SHADOW,
              }}
            >
              HAFF PicklePulse
            </p>

            <h1
              style={{
                margin: "28px 0 0",
                fontSize: 88,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                textShadow: TEXT_SHADOW_HEAVY,
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              {playerName}
            </h1>

            <p
              style={{
                margin: "16px 0 0",
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: BRASS,
                textShadow: TEXT_SHADOW,
              }}
            >
              {skillLevel}
            </p>

            <div style={{ marginTop: 72, width: "100%", display: "flex", flexDirection: "column", gap: 36 }}>
              {statLines.map(({ label, value }) => (
                <div key={label}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "rgba(244,241,232,0.82)",
                      textShadow: LABEL_SHADOW,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: label === "Favorite Court" ? 56 : 96,
                      fontWeight: 900,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      textShadow: TEXT_SHADOW_HEAVY,
                      wordBreak: "break-word",
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <p
              style={{
                marginTop: 64,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(244,241,232,0.7)",
                textShadow: LABEL_SHADOW,
              }}
            >
              Last visit · {lastPlay}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} style={storyCanvasStyle()}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "200px 64px 260px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: ACCENT,
                textShadow: LABEL_SHADOW,
              }}
            >
              HAFF PicklePulse
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(244,241,232,0.65)",
                textShadow: LABEL_SHADOW,
              }}
            >
              Open Play Session
            </p>
          </div>

          <div style={{ textAlign: "center" }}>
            <p
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(244,241,232,0.85)",
                textShadow: LABEL_SHADOW,
              }}
            >
              Court Time
            </p>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 168,
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                textShadow: TEXT_SHADOW_HEAVY,
              }}
            >
              {minutesLabel}
            </p>

            <h1
              style={{
                margin: "48px 0 0",
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                textShadow: TEXT_SHADOW_HEAVY,
                wordBreak: "break-word",
              }}
            >
              {playerName}
            </h1>
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: BRASS,
                textShadow: TEXT_SHADOW,
              }}
            >
              {skillLevel}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
              textAlign: "center",
            }}
          >
            {[
              { label: "Games", value: String(totalGamesPlayed) },
              { label: "Visits", value: String(totalDaysPlayed) },
              { label: "Fav Court", value: favCourtLabel },
            ].map(({ label, value }) => (
              <div key={label}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(244,241,232,0.75)",
                    textShadow: LABEL_SHADOW,
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: label === "Fav Court" ? 36 : 64,
                    fontWeight: 900,
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                    textShadow: TEXT_SHADOW_HEAVY,
                    wordBreak: "break-word",
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(244,241,232,0.65)",
              textShadow: LABEL_SHADOW,
            }}
          >
            Last visit · {lastPlay}
          </p>
        </div>
      </div>
    );
  }
);

export function StoryShareModal({ onClose, layout: initialLayout = "overlay-hero", ...cardProps }: StoryShareModalProps) {
  const [layout, setLayout] = React.useState<StoryShareLayout>(initialLayout);
  const [isCopying, setIsCopying] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [copyResult, setCopyResult] = React.useState<"copied" | "downloaded" | null>(null);
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
  const previewBudget = Math.min(300, modalMaxH * 0.38);
  const scale = Math.min(1, previewBudget / STORY_H);

  const activeLayout = LAYOUT_OPTIONS.find((option) => option.id === layout);
  const filename = `haff-picklepulse-${cardProps.playerName.toLowerCase().replace(/\s+/g, "-")}.png`;

  const handleCopy = async () => {
    if (!captureRef.current) return;
    setIsCopying(true);
    setCopyResult(null);
    try {
      const result = await copyElementAsImageToClipboard(captureRef.current, filename, 2, {
        backgroundColor: null,
      });
      setCopyResult(result);
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

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLayout(option.id)}
                className={`rounded-lg py-3 text-[11px] font-black uppercase tracking-wider transition ${
                  layout === option.id ? "bg-[#2ee882] text-[#020f0a]" : "text-ivory/60 hover:text-ivory"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div
            className="flex justify-center mb-4 min-h-0 shrink rounded-xl overflow-hidden"
            style={{
              height: Math.max(160, STORY_H * scale),
              background: "repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px",
            }}
          >
            <div
              style={{
                width: STORY_W,
                transform: `scale(${scale})`,
                transformOrigin: "top center",
                flexShrink: 0,
              }}
            >
              <StoryStatsCard layout={layout} {...cardProps} />
            </div>
          </div>

          <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}>
            <StoryStatsCard ref={captureRef} layout={layout} {...cardProps} />
          </div>

          {copyResult && (
            <div
              className={`mb-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-center ${
                copyResult === "copied"
                  ? "bg-[#2ee882]/15 text-[#2ee882] border border-[#2ee882]/25"
                  : "bg-amber-400/15 text-amber-300 border border-amber-400/25"
              }`}
            >
              {copyResult === "copied"
                ? "Transparent story copied! Open Instagram Stories, add your photo, then paste as a sticker."
                : "Transparent PNG saved! Add it as a sticker over your story photo in Instagram."}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isCopying}
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#2ee882] py-3.5 text-sm font-black text-[#020f0a] hover:bg-[#4dea96] disabled:opacity-50 transition"
            >
              {copyResult === "copied" ? <CheckCheck size={18} /> : <Copy size={18} />}
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
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#060f0a] p-6 shadow-2xl"
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
                  <h3 className="font-bold text-ivory">Pick Hero or Stats</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Both layouts are <strong>1080×1920</strong> transparent overlays sized for Instagram Stories. Text uses drop shadows so it reads on any photo.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">2</div>
                  <h3 className="font-bold text-ivory">Copy or Download</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Tap <strong>Copy Image</strong> or <strong>Download</strong> to export a transparent PNG with your real stats — games, court time, visits, and favorite court.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">3</div>
                  <h3 className="font-bold text-ivory">Post on Instagram Stories</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Open Instagram Stories, pick or take a photo, then add the PNG as a sticker (paste from clipboard or upload from your gallery). Position and resize as you like.
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
