import React from "react";
import type { PlayerGameStats } from "./playerStats";
import { formatMinutesPlayed } from "./playerStats";

export type StoryShareLayout =
  | "overlay-hero"
  | "overlay-stats"
  | "overlay-minimal"
  | "overlay-crown"
  | "overlay-split"
  | "overlay-ticket"
  | "overlay-rail"
  | "overlay-stack"
  | "overlay-focus"
  | "overlay-frame";

export const STORY_W = 1080;
export const STORY_H = 1920;

export const LAYOUT_OPTIONS: Array<{ id: StoryShareLayout; label: string; hint: string }> = [
  { id: "overlay-hero", label: "Hero", hint: "Big court time front and center" },
  { id: "overlay-stats", label: "Stats", hint: "Full vertical stat stack" },
  { id: "overlay-minimal", label: "Minimal", hint: "Clean name with a slim stat strip" },
  { id: "overlay-crown", label: "Crown", hint: "Games highlighted as the headline" },
  { id: "overlay-split", label: "Split", hint: "Court time beside a stat column" },
  { id: "overlay-ticket", label: "Ticket", hint: "Perforated ticket stub look" },
  { id: "overlay-rail", label: "Rail", hint: "Accent rail with stacked stats" },
  { id: "overlay-stack", label: "Stack", hint: "Four equal stat cards" },
  { id: "overlay-focus", label: "Focus", hint: "Favorite court as the hero" },
  { id: "overlay-frame", label: "Frame", hint: "Bordered 2×2 stat grid" }
];

const IVORY = "#f4f1e8";
const ACCENT = "#2ee882";
const BRASS = "#d4a843";
const TEXT_SHADOW =
  "0 2px 6px rgba(0,0,0,0.92), 0 4px 18px rgba(0,0,0,0.78), 0 1px 0 rgba(0,0,0,1)";
const TEXT_SHADOW_HEAVY =
  "0 3px 10px rgba(0,0,0,0.95), 0 6px 28px rgba(0,0,0,0.82), 0 1px 2px rgba(0,0,0,1)";
const LABEL_SHADOW = "0 1px 4px rgba(0,0,0,0.88), 0 2px 12px rgba(0,0,0,0.65)";

export interface StoryCardProps {
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

function canvasStyle(): React.CSSProperties {
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
    boxSizing: "border-box"
  };
}

type StoryContent = {
  playerName: string;
  skillLevel: string;
  totalDaysPlayed: number;
  totalGamesPlayed: number;
  lastPlay: string;
  minutesLabel: string;
  favCourtLabel: string;
};

function buildContent(props: StoryCardProps): StoryContent {
  return {
    playerName: props.playerName,
    skillLevel: props.skillLevel,
    totalDaysPlayed: props.totalDaysPlayed,
    totalGamesPlayed: props.totalGamesPlayed,
    lastPlay: props.lastPlayedDate
      ? new Date(props.lastPlayedDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      : "—",
    minutesLabel: formatMinutesPlayed(props.stats.minutesPlayed),
    favCourtLabel: props.stats.favCourt?.name ?? "—"
  };
}

function Brand({ size = 22 }: { size?: number }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: ACCENT,
        textShadow: LABEL_SHADOW
      }}
    >
      HAFF PicklePulse
    </p>
  );
}

function Name({ children, size = 72 }: { children: React.ReactNode; size?: number }) {
  return (
    <h1
      style={{
        margin: 0,
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1.05,
        letterSpacing: "-0.03em",
        textShadow: TEXT_SHADOW_HEAVY,
        wordBreak: "break-word"
      }}
    >
      {children}
    </h1>
  );
}

function Skill({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "14px 0 0",
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: BRASS,
        textShadow: TEXT_SHADOW
      }}
    >
      {children}
    </p>
  );
}

function StatValue({ label, value, valueSize = 72 }: { label: string; value: string; valueSize?: number }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(244,241,232,0.78)",
          textShadow: LABEL_SHADOW
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: valueSize,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          textShadow: TEXT_SHADOW_HEAVY,
          wordBreak: "break-word"
        }}
      >
        {value}
      </p>
    </div>
  );
}

function LastVisit({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(244,241,232,0.65)",
        textShadow: LABEL_SHADOW
      }}
    >
      {children}
    </p>
  );
}

function LayoutHero({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "200px 64px 260px" }}>
      <div style={{ textAlign: "center" }}>
        <Brand />
        <p style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(244,241,232,0.65)", textShadow: LABEL_SHADOW }}>
          Open Play Session
        </p>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(244,241,232,0.85)", textShadow: LABEL_SHADOW }}>Court Time</p>
        <p style={{ margin: "12px 0 0", fontSize: 168, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", textShadow: TEXT_SHADOW_HEAVY }}>{c.minutesLabel}</p>
        <div style={{ marginTop: 48 }}>
          <Name size={72}>{c.playerName}</Name>
          <Skill>{c.skillLevel}</Skill>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, textAlign: "center" }}>
        <StatValue label="Games" value={String(c.totalGamesPlayed)} valueSize={64} />
        <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={64} />
        <StatValue label="Fav Court" value={c.favCourtLabel} valueSize={36} />
      </div>
      <LastVisit>Last visit · {c.lastPlay}</LastVisit>
    </div>
  );
}

function LayoutStats({ c }: { c: StoryContent }) {
  const lines = [
    { label: "Games", value: String(c.totalGamesPlayed), size: 96 },
    { label: "Court Time", value: c.minutesLabel, size: 96 },
    { label: "Visits", value: String(c.totalDaysPlayed), size: 96 },
    { label: "Favorite Court", value: c.favCourtLabel, size: 56 }
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "220px 72px 280px", textAlign: "center" }}>
      <Brand />
      <div style={{ marginTop: 28 }}>
        <Name size={88}>{c.playerName}</Name>
        <Skill>{c.skillLevel}</Skill>
      </div>
      <div style={{ marginTop: 72, width: "100%", display: "flex", flexDirection: "column", gap: 36 }}>
        {lines.map(({ label, value, size }) => (
          <StatValue key={label} label={label} value={value} valueSize={size} />
        ))}
      </div>
      <div style={{ marginTop: 64 }}>
        <LastVisit>Last visit · {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

function LayoutMinimal({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "180px 56px 220px" }}>
      <Brand size={20} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <Name size={96}>{c.playerName}</Name>
        <Skill>{c.skillLevel}</Skill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, borderTop: `3px solid ${ACCENT}`, paddingTop: 28 }}>
        <StatValue label="Games" value={String(c.totalGamesPlayed)} valueSize={44} />
        <StatValue label="Time" value={c.minutesLabel} valueSize={44} />
        <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={44} />
        <StatValue label="Court" value={c.favCourtLabel} valueSize={28} />
      </div>
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <LastVisit>Last visit · {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

function LayoutCrown({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "200px 64px 240px", textAlign: "center" }}>
      <Brand />
      <div style={{ marginTop: 36 }}>
        <Name size={64}>{c.playerName}</Name>
        <Skill>{c.skillLevel}</Skill>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(244,241,232,0.8)", textShadow: LABEL_SHADOW }}>Games Played</p>
        <p style={{ margin: "16px 0 0", fontSize: 220, fontWeight: 900, lineHeight: 0.85, letterSpacing: "-0.05em", color: ACCENT, textShadow: TEXT_SHADOW_HEAVY }}>{c.totalGamesPlayed}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <StatValue label="Court Time" value={c.minutesLabel} valueSize={48} />
        <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={48} />
        <StatValue label="Fav Court" value={c.favCourtLabel} valueSize={32} />
      </div>
      <div style={{ marginTop: 28 }}>
        <LastVisit>Last visit · {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

function LayoutSplit({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, display: "flex", padding: "180px 48px 220px", gap: 32 }}>
      <div style={{ flex: "0 0 42%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}>
        <Brand size={18} />
        <Name size={52}>{c.playerName}</Name>
        <Skill>{c.skillLevel}</Skill>
        <StatValue label="Games" value={String(c.totalGamesPlayed)} valueSize={56} />
        <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={56} />
        <StatValue label="Fav Court" value={c.favCourtLabel} valueSize={36} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderLeft: `4px solid ${ACCENT}`, paddingLeft: 32 }}>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", textShadow: LABEL_SHADOW }}>Court Time</p>
        <p style={{ margin: "20px 0 0", fontSize: 140, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", textShadow: TEXT_SHADOW_HEAVY }}>{c.minutesLabel}</p>
      </div>
    </div>
  );
}

function LayoutTicket({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, padding: "160px 48px 200px", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, border: `4px dashed rgba(46,232,130,0.85)`, borderRadius: 28, padding: "56px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ textAlign: "center" }}>
          <Brand />
          <div style={{ marginTop: 32 }}>
            <Name size={68}>{c.playerName}</Name>
            <Skill>{c.skillLevel}</Skill>
          </div>
        </div>
        <div style={{ borderTop: "2px dashed rgba(244,241,232,0.35)", borderBottom: "2px dashed rgba(244,241,232,0.35)", padding: "36px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <StatValue label="Court Time" value={c.minutesLabel} valueSize={52} />
          <StatValue label="Games" value={String(c.totalGamesPlayed)} valueSize={52} />
          <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={52} />
          <StatValue label="Fav Court" value={c.favCourtLabel} valueSize={34} />
        </div>
        <LastVisit>Admit one · Last visit {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

function LayoutRail({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, display: "flex", padding: "180px 0 220px 0" }}>
      <div style={{ width: 18, background: ACCENT, boxShadow: "0 0 40px rgba(46,232,130,0.45)" }} />
      <div style={{ flex: 1, padding: "0 56px 0 48px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
        <Brand />
        <Name size={76}>{c.playerName}</Name>
        <Skill>{c.skillLevel}</Skill>
        {[
          { label: "Court Time", value: c.minutesLabel, size: 80 },
          { label: "Games", value: String(c.totalGamesPlayed), size: 80 },
          { label: "Visits", value: String(c.totalDaysPlayed), size: 80 },
          { label: "Favorite Court", value: c.favCourtLabel, size: 48 }
        ].map(({ label, value, size }) => (
          <StatValue key={label} label={label} value={value} valueSize={size} />
        ))}
        <LastVisit>Last visit · {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

function LayoutStack({ c }: { c: StoryContent }) {
  const cards = [
    { label: "Court Time", value: c.minutesLabel },
    { label: "Games", value: String(c.totalGamesPlayed) },
    { label: "Visits", value: String(c.totalDaysPlayed) },
    { label: "Favorite Court", value: c.favCourtLabel }
  ];
  return (
    <div style={{ flex: 1, padding: "180px 56px 220px", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <Brand />
        <div style={{ marginTop: 24 }}>
          <Name size={64}>{c.playerName}</Name>
          <Skill>{c.skillLevel}</Skill>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, justifyContent: "center" }}>
        {cards.map(({ label, value }) => (
          <div key={label} style={{ border: "2px solid rgba(244,241,232,0.22)", borderRadius: 20, padding: "24px 28px", background: "rgba(0,0,0,0.18)" }}>
            <StatValue label={label} value={value} valueSize={label === "Favorite Court" ? 40 : 56} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28, textAlign: "center" }}>
        <LastVisit>Last visit · {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

function LayoutFocus({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, padding: "200px 64px 260px", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "center" }}>
      <Brand />
      <div>
        <Name size={56}>{c.playerName}</Name>
        <Skill>{c.skillLevel}</Skill>
        <p style={{ margin: "48px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: BRASS, textShadow: LABEL_SHADOW }}>Home Court</p>
        <p style={{ margin: "20px 0 0", fontSize: 120, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", textShadow: TEXT_SHADOW_HEAVY, wordBreak: "break-word" }}>{c.favCourtLabel}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <StatValue label="Time" value={c.minutesLabel} valueSize={40} />
        <StatValue label="Games" value={String(c.totalGamesPlayed)} valueSize={40} />
        <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={40} />
      </div>
      <LastVisit>Last visit · {c.lastPlay}</LastVisit>
    </div>
  );
}

function LayoutFrame({ c }: { c: StoryContent }) {
  return (
    <div style={{ flex: 1, padding: "150px 40px 190px" }}>
      <div style={{ height: "100%", border: `6px double ${ACCENT}`, borderRadius: 8, padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ textAlign: "center" }}>
          <Brand />
          <div style={{ marginTop: 28 }}>
            <Name size={60}>{c.playerName}</Name>
            <Skill>{c.skillLevel}</Skill>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, padding: "24px 0" }}>
          <StatValue label="Court Time" value={c.minutesLabel} valueSize={48} />
          <StatValue label="Games" value={String(c.totalGamesPlayed)} valueSize={48} />
          <StatValue label="Visits" value={String(c.totalDaysPlayed)} valueSize={48} />
          <StatValue label="Fav Court" value={c.favCourtLabel} valueSize={34} />
        </div>
        <LastVisit>Last visit · {c.lastPlay}</LastVisit>
      </div>
    </div>
  );
}

const LAYOUT_RENDERERS: Record<StoryShareLayout, React.FC<{ c: StoryContent }>> = {
  "overlay-hero": LayoutHero,
  "overlay-stats": LayoutStats,
  "overlay-minimal": LayoutMinimal,
  "overlay-crown": LayoutCrown,
  "overlay-split": LayoutSplit,
  "overlay-ticket": LayoutTicket,
  "overlay-rail": LayoutRail,
  "overlay-stack": LayoutStack,
  "overlay-focus": LayoutFocus,
  "overlay-frame": LayoutFrame
};

export const StoryStatsCard = React.forwardRef<HTMLDivElement, StoryCardProps>(function StoryStatsCard(props, ref) {
  const layout = props.layout ?? "overlay-hero";
  const content = buildContent(props);
  const Renderer = LAYOUT_RENDERERS[layout] ?? LayoutHero;
  return (
    <div ref={ref} style={canvasStyle()}>
      <Renderer c={content} />
    </div>
  );
});
