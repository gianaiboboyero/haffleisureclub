import React from "react";
import { X, Download, Copy, CheckCheck, Share2 } from "lucide-react";
import type { PlayerGameStats } from "../lib/playerStats";
import { formatMinutesPlayed } from "../lib/playerStats";
import { copyElementAsImageToClipboard, downloadElementAsImage } from "../lib/storyShare";

export type StoryShareLayout = "story" | "sticker";

interface StoryCardProps {
  playerName: string;
  skillLevel: string;
  avatarUrl?: string;
  totalDaysPlayed: number;
  lastPlayedDate?: string;
  stats: PlayerGameStats;
  layout?: StoryShareLayout;
  cardRef?: React.Ref<HTMLDivElement>;
}

interface StoryShareModalProps extends StoryCardProps {
  onClose: () => void;
}

const ACCENT_GREEN = "#2ee882";
const BRASS = "#d4a843";
const IVORY = "#f4f1e8";
const DIM = "rgba(244,241,232,0.45)";
const BG_DEEP = "#020f0a";
const BG_MID = "#071a12";

const STICKER_DROP_SHADOW =
  "drop-shadow(0 28px 56px rgba(0,0,0,0.62)) drop-shadow(0 10px 24px rgba(0,0,0,0.45)) drop-shadow(0 2px 8px rgba(0,0,0,0.35))";

export const StoryStatsCard = React.forwardRef<HTMLDivElement, StoryCardProps>(
  function StoryStatsCard(
    { playerName, skillLevel, avatarUrl, totalDaysPlayed, lastPlayedDate, stats, layout = "story" },
    ref
  ) {
    const isSticker = layout === "sticker";
    const lastPlay = lastPlayedDate
      ? new Date(lastPlayedDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      : "—";
    const minutesLabel = formatMinutesPlayed(stats.minutesPlayed);

    const skillColor: Record<string, string> = {
      Pro: "#2ee882",
      Intermediate: "#4ade80",
      "Low Intermediate": "#86efac",
      Novice: BRASS,
      Beginner: BRASS,
      Newbie: "#d97706",
    };
    const badgeColor = skillColor[skillLevel] ?? BRASS;

    const statTiles = [
      { value: stats.gamesPlayed, label: "Games" },
      { value: minutesLabel, label: "Court Time" },
      { value: totalDaysPlayed, label: "Visits" },
    ];

    return (
      <div
        ref={ref}
        style={{
          width: isSticker ? 420 : 540,
          height: isSticker ? "auto" : 960,
          minHeight: isSticker ? undefined : 960,
          background: isSticker ? "transparent" : `linear-gradient(165deg, ${BG_MID} 0%, ${BG_DEEP} 55%, #040e09 100%)`,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          overflow: isSticker ? "visible" : "hidden",
          color: IVORY,
          flexShrink: 0,
          padding: isSticker ? "12px 16px 20px" : 0,
          boxSizing: "border-box",
          filter: isSticker ? STICKER_DROP_SHADOW : undefined,
        }}
      >
        {!isSticker && (
          <>
            <div
              style={{
                position: "absolute",
                top: -120,
                left: "50%",
                transform: "translateX(-50%)",
                width: 600,
                height: 600,
                background: "radial-gradient(ellipse at center, rgba(46,232,130,0.09) 0%, transparent 65%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                width: "100%",
                height: 3,
                background: `linear-gradient(90deg, transparent, ${ACCENT_GREEN}, transparent)`,
              }}
            />
          </>
        )}

        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isSticker ? "0 0 16px" : "20px 32px 0",
            borderBottom: isSticker ? `1px solid rgba(46,232,130,0.25)` : undefined,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: ACCENT_GREEN,
                margin: 0,
              }}
            >
              HAFF PicklePulse
            </p>
            <p style={{ fontSize: 10, color: DIM, margin: "3px 0 0", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              HAFF Leisure Club
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: isSticker ? 20 : 36,
            width: isSticker ? 112 : 140,
            height: isSticker ? 112 : 140,
            borderRadius: "50%",
            border: `3px solid ${ACCENT_GREEN}`,
            boxShadow: isSticker
              ? "0 8px 32px rgba(0,0,0,0.35)"
              : `0 0 32px rgba(46,232,130,0.25), 0 0 0 6px rgba(46,232,130,0.07)`,
            overflow: "hidden",
            background: isSticker ? "#0f2e24" : "#0f2e24",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 44, fontWeight: 900, color: ACCENT_GREEN }}>
              {playerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <p style={{ marginTop: 16, fontSize: isSticker ? 28 : 34, fontWeight: 900, textAlign: "center", padding: "0 16px", lineHeight: 1.1 }}>
          {playerName}
        </p>

        <div
          style={{
            marginTop: 8,
            padding: "4px 18px",
            borderRadius: 999,
            border: `1.5px solid ${badgeColor}`,
            background: `rgba(${hexToRgb(badgeColor)}, 0.12)`,
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: badgeColor, margin: 0 }}>
            {skillLevel}
          </p>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            width: "100%",
            padding: isSticker ? 0 : "0 32px",
            boxSizing: "border-box",
          }}
        >
          {statTiles.map(({ value, label }) => (
            <div
              key={label}
              style={{
                flex: 1,
                background: isSticker ? "rgba(15,46,36,0.92)" : "rgba(46,232,130,0.06)",
                border: isSticker ? "1px solid rgba(46,232,130,0.22)" : "1px solid rgba(46,232,130,0.15)",
                borderRadius: 16,
                padding: "14px 8px",
                textAlign: "center",
                backdropFilter: isSticker ? "blur(8px)" : undefined,
                boxShadow: isSticker ? "0 10px 28px rgba(0,0,0,0.38)" : undefined,
              }}
            >
              <p style={{ fontSize: label === "Court Time" ? 18 : 28, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: DIM, margin: "6px 0 0" }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {(stats.favCourt || lastPlayedDate) && (
          <div
            style={{
              marginTop: 14,
              width: "100%",
              padding: isSticker ? 0 : "0 32px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                background: isSticker ? "rgba(15,46,36,0.88)" : "rgba(244,241,232,0.04)",
                border: isSticker ? "1px solid rgba(244,241,232,0.12)" : "1px solid rgba(244,241,232,0.08)",
                borderRadius: 16,
                padding: "14px 16px",
                textAlign: stats.favCourt ? "left" : "center",
              }}
            >
              {stats.favCourt ? (
                <>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: DIM, margin: 0 }}>
                    Favorite court
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: BRASS, margin: "4px 0 0" }}>{stats.favCourt.name}</p>
                  <p style={{ fontSize: 10, color: DIM, margin: "3px 0 0" }}>
                    {stats.favCourt.gamesOnCourt} game{stats.favCourt.gamesOnCourt !== 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: DIM, margin: 0 }}>
                    Last visit
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 800, margin: "4px 0 0" }}>{lastPlay}</p>
                </>
              )}
            </div>
          </div>
        )}

        {!isSticker && <div style={{ flex: 1 }} />}

        {!isSticker && (
          <>
            <div style={{ width: "100%", padding: "16px 32px 24px", borderTop: "1px solid rgba(244,241,232,0.07)" }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: DIM, margin: 0, textAlign: "center" }}>
                Played at HAFF Leisure Club
              </p>
            </div>
            <div style={{ width: "100%", height: 3, background: `linear-gradient(90deg, transparent, ${ACCENT_GREEN}, transparent)` }} />
          </>
        )}
      </div>
    );
  }
);

export function StoryShareModal({ onClose, layout: initialLayout = "sticker", ...cardProps }: StoryShareModalProps) {
  const [layout, setLayout] = React.useState<StoryShareLayout>(initialLayout);
  const [isCopying, setIsCopying] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [copyResult, setCopyResult] = React.useState<"copied" | "downloaded" | null>(null);
  const captureRef = React.useRef<HTMLDivElement>(null);
  const [viewportH, setViewportH] = React.useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));

  React.useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const CARD_W = layout === "sticker" ? 420 : 540;
  const CARD_H = layout === "sticker" ? 420 : 960;
  const dockClearance = 112;
  const modalMaxH = Math.max(320, viewportH - dockClearance - 24);
  const previewBudget = Math.min(layout === "sticker" ? 280 : 360, modalMaxH * 0.42);
  const scale = Math.min(1, previewBudget / CARD_H, (viewportH - dockClearance - 280) / CARD_H);

  const exportOptions = { backgroundColor: layout === "sticker" ? null : undefined };
  const filename = `haff-picklepulse-story-${cardProps.playerName.toLowerCase().replace(/\s+/g, "-")}.png`;

  const handleCopy = async () => {
    if (!captureRef.current) return;
    setIsCopying(true);
    setCopyResult(null);
    try {
      const result = await copyElementAsImageToClipboard(captureRef.current, filename, 2, exportOptions);
      setCopyResult(result);
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      await downloadElementAsImage(captureRef.current, filename, 2, exportOptions);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center bg-black/80 px-3 pt-3 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#060f0a] p-4 shadow-2xl overflow-y-auto sm:p-5"
        style={{ maxHeight: modalMaxH }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-[#2ee882]" />
            <span className="text-sm font-black uppercase tracking-widest text-ivory">Share Story</span>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-ivory/60 hover:text-ivory" type="button">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setLayout("sticker")}
            className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-wider transition ${
              layout === "sticker" ? "bg-[#2ee882] text-[#020f0a]" : "text-ivory/60 hover:text-ivory"
            }`}
          >
            Transparent sticker
          </button>
          <button
            type="button"
            onClick={() => setLayout("story")}
            className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-wider transition ${
              layout === "story" ? "bg-[#2ee882] text-[#020f0a]" : "text-ivory/60 hover:text-ivory"
            }`}
          >
            Full story
          </button>
        </div>

        <div
          className="flex justify-center mb-4 min-h-0 shrink"
          style={{
            height: Math.max(140, CARD_H * scale),
            background: layout === "sticker" ? "repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px" : undefined,
            borderRadius: 16,
            padding: layout === "sticker" ? 12 : 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: CARD_W,
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
              ? "Story image copied. Open Instagram and paste it into your story."
              : "Clipboard copy is not supported here. Image downloaded instead."}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isCopying}
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#2ee882] py-3 text-sm font-black text-[#020f0a] hover:bg-[#4dea96] disabled:opacity-50 transition"
          >
            {copyResult === "copied" ? <CheckCheck size={16} /> : <Copy size={16} />}
            {isCopying ? "Generating…" : "Copy Image"}
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-black text-ivory hover:bg-white/15 disabled:opacity-50 transition"
          >
            <Download size={16} />
            {isDownloading ? "Saving…" : "Download"}
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-ivory/45">
          {layout === "sticker"
            ? "Transparent sticker — paste over your own photo or video in Instagram."
            : "Full story — ready-made 9:16 background for Instagram Stories."}
        </p>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
