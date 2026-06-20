import React from "react";
import { X, Download, Copy, CheckCheck, Share2, HelpCircle, Twitter, Linkedin, MessageCircle } from "lucide-react";
import type { PlayerGameStats } from "../lib/playerStats";
import { formatMinutesPlayed } from "../lib/playerStats";
import { copyElementAsImageToClipboard, downloadElementAsImage } from "../lib/storyShare";

export type StoryShareLayout = "minimal" | "strava" | "gradient" | "bold" | "sticker" | "classic";

const LAYOUT_OPTIONS: Array<{ id: StoryShareLayout; label: string; hint: string }> = [
  { id: "minimal", label: "Minimal", hint: "Clean white square — Instagram feed" },
  { id: "strava", label: "Activity", hint: "Strava-style story with hero stat" },
  { id: "gradient", label: "Gradient", hint: "Colorful 9:16 story" },
  { id: "bold", label: "Bold", hint: "Dark high-contrast story" },
  { id: "sticker", label: "Sticker", hint: "Transparent overlay for photos" },
  { id: "classic", label: "Classic", hint: "HAFF branded story" },
];

function isSquareLayout(layout: StoryShareLayout) {
  return layout === "minimal" || layout === "sticker";
}

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

const ACCENT_GREEN = "#2ee882";
const BRASS = "#d4a843";
const IVORY = "#f4f1e8";
const DIM = "rgba(244,241,232,0.45)";

export const StoryStatsCard = React.forwardRef<HTMLDivElement, StoryCardProps>(
  function StoryStatsCard(
    { playerName, skillLevel, avatarUrl, totalDaysPlayed, totalGamesPlayed, lastPlayedDate, stats, layout = "minimal" },
    ref
  ) {
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
      { value: totalGamesPlayed, label: "Games", unit: "" },
      { value: minutesLabel, label: "Court Time", unit: "" },
      { value: totalDaysPlayed, label: "Visits", unit: "" },
    ];

    // Minimal (Strava-inspired)
    if (layout === "minimal") {
      return (
        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1080,
            background: "#ffffff",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            color: "#000000",
          }}
        >
          {/* Subtle accent bar */}
          <div style={{ width: "100%", height: 4, background: ACCENT_GREEN }} />

          {/* Header */}
          <div style={{ padding: "32px 40px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", color: "#999", margin: 0, textTransform: "uppercase" }}>
                HAFF PicklePulse
              </p>
              <p style={{ fontSize: 11, color: "#bbb", margin: "4px 0 0", letterSpacing: "0.02em" }}>
                HAFF Leisure Club
              </p>
            </div>
            {avatarUrl && (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid #f0f0f0",
                }}
              >
                <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>

          {/* Player info */}
          <div style={{ padding: "0 40px 32px" }}>
            <h1 style={{ fontSize: 48, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {playerName}
            </h1>
            <div style={{ marginTop: 12, display: "inline-block", padding: "6px 14px", borderRadius: 6, background: "#f5f5f5" }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#666", margin: 0 }}>
                {skillLevel}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ padding: "0 40px", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            {statTiles.map(({ value, label }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "24px 0",
                  borderBottom: "1px solid #e5e5e5",
                }}
              >
                <p style={{ fontSize: 16, fontWeight: 600, color: "#666", margin: 0, letterSpacing: "0.02em" }}>
                  {label}
                </p>
                <p style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{value}</p>
              </div>
            ))}
            {stats.favCourt && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "24px 0",
                  borderBottom: "1px solid #e5e5e5",
                }}
              >
                <p style={{ fontSize: 16, fontWeight: 600, color: "#666", margin: 0, letterSpacing: "0.02em" }}>
                  Favorite Court
                </p>
                <p style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{stats.favCourt.name}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "32px 40px", borderTop: "1px solid #e5e5e5" }}>
            <p style={{ fontSize: 13, color: "#999", margin: 0, textAlign: "center" }}>
              Last visit: {lastPlay}
            </p>
          </div>
        </div>
      );
    }

    // Activity (Strava-inspired story)
    if (layout === "strava") {
      return (
        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1920,
            background: "#f7f7f5",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            color: "#1a1a1a",
          }}
        >
          <div style={{ padding: "56px 64px 0" }}>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT_GREEN, margin: 0 }}>
              HAFF PicklePulse
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0" }}>Open Play Session</p>
          </div>

          <div style={{ padding: "72px 64px 48px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666", margin: 0 }}>
              Court Time
            </p>
            <p style={{ fontSize: 140, fontWeight: 900, margin: "8px 0 0", letterSpacing: "-0.04em", lineHeight: 0.9, color: "#111" }}>
              {minutesLabel}
            </p>

            <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid #e8e8e8",
                  background: "#fff",
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 36, fontWeight: 900, color: ACCENT_GREEN }}>
                    {playerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{playerName}</p>
                <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#888", margin: "8px 0 0" }}>
                  {skillLevel}
                </p>
              </div>
            </div>

            <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {statTiles.map(({ value, label }) => (
                <div
                  key={label}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: "24px 16px",
                    textAlign: "center",
                    border: "1px solid #ebebeb",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <p style={{ fontSize: label === "Court Time" ? 22 : 36, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "10px 0 0" }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {stats.favCourt && (
              <div style={{ marginTop: 20, background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #ebebeb" }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: 0 }}>
                  Favorite Court
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>{stats.favCourt.name}</p>
              </div>
            )}
          </div>

          <div style={{ padding: "40px 64px 56px", borderTop: "1px solid #e5e5e5" }}>
            <p style={{ fontSize: 13, color: "#999", margin: 0, textAlign: "center" }}>
              HAFF Leisure Club · Last visit {lastPlay}
            </p>
          </div>
        </div>
      );
    }

    // Gradient
    if (layout === "gradient") {
      return (
        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1920,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            color: "#ffffff",
            padding: "60px 80px",
            boxSizing: "border-box",
          }}
        >
          {/* Overlay pattern */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.1) 0%, transparent 50%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>
            {/* Avatar */}
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                overflow: "hidden",
                border: "5px solid rgba(255,255,255,0.3)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                margin: "0 auto",
                background: "rgba(255,255,255,0.1)",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 64, fontWeight: 900 }}>
                  {playerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <h1 style={{ fontSize: 64, fontWeight: 900, margin: "40px 0 16px", textShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
              {playerName}
            </h1>

            <div style={{ display: "inline-block", padding: "10px 24px", borderRadius: 30, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                {skillLevel}
              </p>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {statTiles.map(({ value, label }) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 24,
                    padding: "32px 20px",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <p style={{ fontSize: 48, fontWeight: 900, margin: 0, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>{value}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "12px 0 0", opacity: 0.9 }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {stats.favCourt && (
              <div
                style={{
                  marginTop: 24,
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 24,
                  padding: "24px",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, opacity: 0.9 }}>
                  Favorite Court
                </p>
                <p style={{ fontSize: 28, fontWeight: 900, margin: "8px 0 0" }}>{stats.favCourt.name}</p>
              </div>
            )}

            <div style={{ marginTop: 60 }}>
              <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0, opacity: 0.7 }}>
                HAFF PicklePulse
              </p>
              <p style={{ fontSize: 12, margin: "8px 0 0", opacity: 0.6 }}>
                Last visit: {lastPlay}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Bold
    if (layout === "bold") {
      return (
        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1920,
            background: "#000000",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            color: "#ffffff",
          }}
        >
          {/* Accent stripe */}
          <div
            style={{
              width: "100%",
              height: 12,
              background: `linear-gradient(90deg, ${ACCENT_GREEN} 0%, ${BRASS} 100%)`,
            }}
          />

          <div style={{ padding: "80px 80px 60px" }}>
            <p style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.15em", color: ACCENT_GREEN, margin: 0, textTransform: "uppercase" }}>
              HAFF PicklePulse
            </p>
            <p style={{ fontSize: 13, color: "#666", margin: "8px 0 0", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              HAFF Leisure Club
            </p>
          </div>

          {/* Hero section */}
          <div style={{ padding: "0 80px 80px", display: "flex", gap: 40, alignItems: "center" }}>
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 24,
                overflow: "hidden",
                border: `4px solid ${ACCENT_GREEN}`,
                boxShadow: `0 0 60px ${ACCENT_GREEN}40`,
                flexShrink: 0,
                background: "#111",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 72, fontWeight: 900, color: ACCENT_GREEN }}>
                  {playerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 72, fontWeight: 900, margin: 0, letterSpacing: "-0.02em", lineHeight: 0.9 }}>
                {playerName}
              </h1>
              <div style={{ marginTop: 20, display: "inline-block", padding: "10px 20px", borderRadius: 8, background: ACCENT_GREEN }}>
                <p style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000", margin: 0 }}>
                  {skillLevel}
                </p>
              </div>
            </div>
          </div>

          {/* Stats blocks */}
          <div style={{ flex: 1, padding: "0 80px", display: "flex", flexDirection: "column", gap: 24 }}>
            {statTiles.map(({ value, label }, i) => (
              <div
                key={label}
                style={{
                  background: "#111",
                  border: `2px solid ${i === 0 ? ACCENT_GREEN : i === 1 ? BRASS : "#333"}`,
                  borderRadius: 20,
                  padding: "40px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
                  {label}
                </p>
                <p style={{ fontSize: 64, fontWeight: 900, margin: 0, letterSpacing: "-0.02em", color: i === 0 ? ACCENT_GREEN : i === 1 ? BRASS : "#fff" }}>
                  {value}
                </p>
              </div>
            ))}

            {stats.favCourt && (
              <div
                style={{
                  background: "#111",
                  border: "2px solid #333",
                  borderRadius: 20,
                  padding: "40px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
                  Favorite Court
                </p>
                <p style={{ fontSize: 56, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>{stats.favCourt.name}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "60px 80px", borderTop: "1px solid #222" }}>
            <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
              Last visit: {lastPlay}
            </p>
          </div>
        </div>
      );
    }

    // Sticker (transparent overlay)
    if (layout === "sticker") {
      return (
        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1080,
            background: "transparent",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "visible",
            color: IVORY,
            padding: 48,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              background: "rgba(7, 26, 18, 0.92)",
              border: "1px solid rgba(46,232,130,0.28)",
              borderRadius: 32,
              padding: "40px 36px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `3px solid ${ACCENT_GREEN}`,
                  flexShrink: 0,
                  background: "#0f2e24",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 32, fontWeight: 900, color: ACCENT_GREEN }}>
                    {playerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT_GREEN, margin: 0 }}>
                  HAFF PicklePulse
                </p>
                <p style={{ fontSize: 32, fontWeight: 900, margin: "6px 0 0", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {playerName}
                </p>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM, margin: "6px 0 0" }}>
                  {skillLevel}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {statTiles.map(({ value, label }) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(46,232,130,0.08)",
                    border: "1px solid rgba(46,232,130,0.18)",
                    borderRadius: 18,
                    padding: "18px 10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: label === "Court Time" ? 18 : 28, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, margin: "8px 0 0" }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {stats.favCourt && (
              <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(244,241,232,0.05)", border: "1px solid rgba(244,241,232,0.08)" }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, margin: 0 }}>
                  Favorite Court · {stats.favCourt.name}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Classic
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          background: "linear-gradient(165deg, #071a12 0%, #020f0a 55%, #040e09 100%)",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          color: IVORY,
          padding: "80px 80px 60px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1200,
            height: 1200,
            background: "radial-gradient(ellipse at center, rgba(46,232,130,0.08) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ width: "100%", height: 4, background: `linear-gradient(90deg, transparent, ${ACCENT_GREEN}, transparent)`, marginBottom: 60 }} />

        <div style={{ textAlign: "center", position: "relative", zIndex: 1, width: "100%" }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: ACCENT_GREEN,
              margin: 0,
            }}
          >
            HAFF PicklePulse
          </p>
          <p style={{ fontSize: 14, color: DIM, margin: "8px 0 0", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            HAFF Leisure Club
          </p>
        </div>

        <div
          style={{
            marginTop: 60,
            width: 240,
            height: 240,
            borderRadius: "50%",
            border: `5px solid ${ACCENT_GREEN}`,
            boxShadow: `0 0 60px rgba(46,232,130,0.3), 0 0 0 10px rgba(46,232,130,0.05)`,
            overflow: "hidden",
            background: "#0f2e24",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 80, fontWeight: 900, color: ACCENT_GREEN }}>
              {playerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h1 style={{ marginTop: 32, fontSize: 64, fontWeight: 900, textAlign: "center", lineHeight: 1.1 }}>
          {playerName}
        </h1>

        <div
          style={{
            marginTop: 16,
            padding: "8px 28px",
            borderRadius: 999,
            border: `2px solid ${badgeColor}`,
            background: `rgba(${hexToRgb(badgeColor)}, 0.12)`,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: badgeColor, margin: 0 }}>
            {skillLevel}
          </p>
        </div>

        <div
          style={{
            marginTop: 60,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            width: "100%",
          }}
        >
          {statTiles.map(({ value, label }) => (
            <div
              key={label}
              style={{
                background: "rgba(46,232,130,0.06)",
                border: "1px solid rgba(46,232,130,0.15)",
                borderRadius: 24,
                padding: "32px 16px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: label === "Court Time" ? 32 : 52, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, margin: "12px 0 0" }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {stats.favCourt && (
          <div
            style={{
              marginTop: 24,
              width: "100%",
              background: "rgba(244,241,232,0.04)",
              border: "1px solid rgba(244,241,232,0.08)",
              borderRadius: 24,
              padding: "32px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, margin: 0 }}>
              Favorite Court
            </p>
            <p style={{ fontSize: 36, fontWeight: 900, color: BRASS, margin: "8px 0 0" }}>{stats.favCourt.name}</p>
            <p style={{ fontSize: 13, color: DIM, margin: "6px 0 0" }}>
              {stats.favCourt.gamesOnCourt} game{stats.favCourt.gamesOnCourt !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ marginTop: 60, width: "100%", padding: "40px 0", borderTop: "1px solid rgba(244,241,232,0.07)", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: DIM, margin: 0 }}>
            Last visit: {lastPlay}
          </p>
        </div>

        <div style={{ width: "100%", height: 4, background: `linear-gradient(90deg, transparent, ${ACCENT_GREEN}, transparent)` }} />
      </div>
    );
  }
);

export function StoryShareModal({ onClose, layout: initialLayout = "minimal", ...cardProps }: StoryShareModalProps) {
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

  const CARD_W = 1080;
  const CARD_H = isSquareLayout(layout) ? 1080 : 1920;
  const dockClearance = 112;
  const modalMaxH = Math.max(360, viewportH - dockClearance - 24);
  const previewBudget = Math.min(isSquareLayout(layout) ? 240 : 280, modalMaxH * 0.35);
  const scale = Math.min(1, previewBudget / CARD_H);

  const exportOptions = {
    backgroundColor:
      layout === "sticker"
        ? null
        : layout === "minimal"
          ? "#ffffff"
          : layout === "strava"
            ? "#f7f7f5"
            : undefined,
  };
  const activeLayout = LAYOUT_OPTIONS.find((option) => option.id === layout);
  const filename = `haff-picklepulse-${cardProps.playerName.toLowerCase().replace(/\s+/g, "-")}.png`;

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

  const handleShareToSocial = async (platform: "twitter" | "whatsapp" | "linkedin") => {
    if (!captureRef.current) return;
    
    // Download the image first
    await handleDownload();
    
    // Open share dialog
    const text = `Check out my PicklePulse stats from HAFF Leisure Club! 🎾\n\n${cardProps.totalGamesPlayed} games played • ${formatMinutesPlayed(cardProps.stats.minutesPlayed)} court time • ${cardProps.totalDaysPlayed} visits`;
    
    if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    } else if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } else if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`, "_blank");
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

          {/* Layout selector — 6 unique designs */}
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-white/5 p-1">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLayout(option.id)}
                className={`rounded-lg py-2.5 text-[10px] font-black uppercase tracking-wider transition ${
                  layout === option.id ? "bg-[#2ee882] text-[#020f0a]" : "text-ivory/60 hover:text-ivory"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div
            className="flex justify-center mb-4 min-h-0 shrink rounded-xl overflow-hidden"
            style={{
              height: Math.max(140, CARD_H * scale),
              background: "repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px",
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
                ? "Image copied! Open Instagram, tap your story camera, and hold to paste."
                : "Image downloaded! Open it in your gallery and share to social media."}
            </div>
          )}

          {/* Primary actions */}
          <div className="flex gap-3 mb-3">
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

          {/* Social sharing */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleShareToSocial("twitter")}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 py-2.5 text-xs font-bold text-[#1DA1F2] hover:bg-[#1DA1F2]/20 transition"
            >
              <Twitter size={16} />
              Twitter
            </button>
            <button
              type="button"
              onClick={() => handleShareToSocial("whatsapp")}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 py-2.5 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/20 transition"
            >
              <MessageCircle size={16} />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => handleShareToSocial("linkedin")}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#0A66C2]/10 border border-[#0A66C2]/20 py-2.5 text-xs font-bold text-[#0A66C2] hover:bg-[#0A66C2]/20 transition"
            >
              <Linkedin size={16} />
              LinkedIn
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] leading-relaxed text-ivory/45">
            {activeLayout?.hint ?? "Choose a layout, then copy or download to share."}
          </p>
        </div>
      </div>

      {/* Help Modal */}
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
                  <h3 className="font-bold text-ivory">Choose Your Style</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Pick from <strong>6 designs</strong>: <strong>Minimal</strong> or <strong>Sticker</strong> for feed/overlays (1:1), <strong>Activity</strong> for Strava-style stories, or <strong>Gradient / Bold / Classic</strong> for full 9:16 stories.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">2</div>
                  <h3 className="font-bold text-ivory">Copy or Download</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Tap <strong>Copy Image</strong> to copy directly to your clipboard, or <strong>Download</strong> to save to your device.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">3</div>
                  <h3 className="font-bold text-ivory">Share to Instagram</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  <strong>For Stories:</strong> Open Instagram, tap the story camera, and long-press the screen to paste. Add your own text or stickers!
                </p>
                <p className="ml-8 text-xs leading-relaxed mt-1">
                  <strong>For Feed:</strong> Tap the + icon, select the downloaded image from your gallery, and post!
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2ee882] text-black text-xs font-black">4</div>
                  <h3 className="font-bold text-ivory">Share to Other Platforms</h3>
                </div>
                <p className="ml-8 text-xs leading-relaxed">
                  Use the <strong>Twitter</strong>, <strong>WhatsApp</strong>, or <strong>LinkedIn</strong> buttons to share with pre-written captions. The image will be downloaded automatically.
                </p>
              </div>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-[#2ee882]/10 border border-[#2ee882]/20">
              <p className="text-xs text-[#2ee882] text-center font-semibold">
                💡 Pro tip: Tag <strong>@haffleisureclub</strong> and use <strong>#PicklePulse</strong> when you share!
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

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
