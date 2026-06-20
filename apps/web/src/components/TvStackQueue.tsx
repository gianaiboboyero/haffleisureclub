import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Court, Match, Player } from "../lib/types";
import {
  createTvVacantSlot,
  getPlayerDisplayLabel,
  getStackLabel,
  getTvStackGroups,
  MAX_STACKS,
} from "../lib/utils";

const VISIBLE_STACKS = 4;
const PAGE_ROTATE_MS = 8000;
const TV_MARQUEE_THRESHOLD = 3;

type StackQueueCardProps = {
  group: Player[];
  groupIndex: number;
  getPlayerAvatar: (player: Player) => string;
  compact?: boolean;
  strip?: boolean;
};

function StackQueueCard({ group, groupIndex, getPlayerAvatar, compact, strip }: StackQueueCardProps) {
  const realCount = group.filter((p) => !p.isVacant).length;
  const isStackNext = groupIndex === 0;

  return (
    <div className={`overflow-hidden rounded-lg border border-[#1e4f3a] ${strip ? "tv-stack-card--strip" : ""}`}>
      <div
        className={`flex items-center justify-between px-2 ${
          strip ? "py-1" : compact ? "py-1" : "py-1.5"
        } ${isStackNext ? "bg-brass" : "bg-[#173d2c]"}`}
      >
        <span
          className={`truncate font-black uppercase tracking-wide ${
            strip ? "text-[10px]" : "text-[10px]"
          } ${isStackNext ? "text-forest" : "text-ivory/70"}`}
        >
          {getStackLabel(groupIndex)}
        </span>
        <span
          className={`ml-1 shrink-0 font-black tabular-nums ${
            strip ? "text-[10px]" : "text-[10px]"
          } ${isStackNext ? "text-forest" : "text-ivory/50"}`}
        >
          {realCount}/4
        </span>
      </div>
      <div className={strip ? "tv-stack-card__strip-slots" : "grid grid-cols-2 gap-px bg-[#1a3f2e]"}>
        {group.map((player) => (
          <div
            key={player.id}
            className={
              strip
                ? "tv-stack-card__strip-slot"
                : `flex items-center gap-1.5 bg-[#0d2e22] px-2 ${compact ? "py-1" : "py-1.5"}`
            }
          >
            <img
              src={getPlayerAvatar(player)}
              alt=""
              className={`shrink-0 rounded-full object-cover border ${
                strip ? "h-6 w-6" : "h-6 w-6"
              } ${player.isVacant ? "border-white/10 opacity-20" : "border-brass/30"} bg-[#173d2c]`}
            />
            {!strip ? (
              <p
                className={`min-w-0 flex-1 truncate text-[10px] font-black leading-tight ${
                  player.isVacant ? "text-ivory/25 italic" : "text-ivory"
                }`}
              >
                {getPlayerDisplayLabel(player)}
              </p>
            ) : (
              <p
                className={`min-w-0 flex-1 truncate text-[10px] font-black leading-tight ${
                  player.isVacant ? "text-ivory/20" : "text-ivory/85"
                }`}
                title={getPlayerDisplayLabel(player)}
              >
                {player.isVacant ? "—" : getPlayerDisplayLabel(player)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function vacantStackGroup(seed: string): Player[] {
  return Array.from({ length: 4 }, (_, index) =>
    createTvVacantSlot(`${seed}-${index}`)
  );
}

function padStackPage(page: Player[][], startIndex: number): Player[][] {
  const padded = [...page];
  while (padded.length < VISIBLE_STACKS) {
    padded.push(vacantStackGroup(`vacant-pad-${startIndex + padded.length}`));
  }
  return padded.slice(0, VISIBLE_STACKS);
}

function buildStackPages(groups: Player[][]): { page: Player[][]; startIndex: number }[] {
  if (groups.length === 0) {
    return [{ page: padStackPage([], 0), startIndex: 0 }];
  }
  const pages: { page: Player[][]; startIndex: number }[] = [];
  for (let index = 0; index < groups.length; index += VISIBLE_STACKS) {
    pages.push({
      page: padStackPage(groups.slice(index, index + VISIBLE_STACKS), index),
      startIndex: index,
    });
  }
  return pages;
}

type TvStackQueueProps = {
  stackOrder: string[];
  players: Player[];
  matches: Match[];
  courts: Court[];
  getPlayerAvatar: (player: Player) => string;
  variant: "tv" | "mobile";
  className?: string;
};

export function TvStackQueue({
  stackOrder,
  players,
  matches,
  courts,
  getPlayerAvatar,
  variant,
  className = "",
}: TvStackQueueProps) {
  const allGroups = getTvStackGroups(stackOrder, players, matches, courts, MAX_STACKS);
  const isTvStrip = variant === "tv";
  const shouldMarquee = isTvStrip && allGroups.length > TV_MARQUEE_THRESHOLD;
  const pages = buildStackPages(allGroups);
  const needsRotation = !shouldMarquee && pages.length > 1;
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    setPageIndex(0);
  }, [stackOrder.join("|"), pages.length]);

  React.useEffect(() => {
    if (!needsRotation) return;
    const timer = window.setInterval(() => {
      setPageIndex((current) => (current + 1) % pages.length);
    }, PAGE_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [needsRotation, pages.length]);

  const activePage = pages[pageIndex] ?? pages[0];
  const gridClass =
    variant === "mobile"
      ? "grid w-full grid-cols-2 gap-2"
      : "tv-display-queue__grid grid w-full grid-cols-2 gap-1 lg:grid-cols-4 lg:gap-1.5";

  return (
    <div className={`tv-display-queue shrink-0 rounded-xl border border-[#1e4f3a] bg-[#0d2e22] ${isTvStrip ? "px-3 py-1.5" : "px-3 py-1.5"} ${className}`}>
      <div className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 ${isTvStrip ? "mb-1" : "mb-1"}`}>
        <p className={`text-center font-black uppercase tracking-[0.18em] text-ivory/45 ${isTvStrip ? "text-[10px]" : "text-[10px]"}`}>
          Stack queue
        </p>
        {needsRotation ? (
          <span className="rounded-full bg-ivory/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-ivory/50">
            {allGroups.length} stacks · page {pageIndex + 1}/{pages.length}
          </span>
        ) : null}
        {shouldMarquee ? (
          <span className="rounded-full bg-ivory/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-ivory/50">
            {allGroups.length} stacks
          </span>
        ) : null}
      </div>

      <div className="relative w-full overflow-hidden">
        {shouldMarquee ? (
          <div className="tv-display-queue__marquee" aria-label={`${allGroups.length} queued stacks`}>
            <div className="tv-display-queue__marquee-track">
              {[...allGroups, ...allGroups].map((group, index) => (
                <StackQueueCard
                  key={`${index}-${group.map((p) => p.id).join("-")}`}
                  group={group}
                  groupIndex={index % allGroups.length}
                  getPlayerAvatar={getPlayerAvatar}
                  compact
                  strip
                />
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activePage.startIndex}-${pageIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className={gridClass}
            >
              {activePage.page.map((group, offset) => (
                <StackQueueCard
                  key={`${activePage.startIndex + offset}-${group.map((p) => p.id).join("-")}`}
                  group={group}
                  groupIndex={activePage.startIndex + offset}
                  getPlayerAvatar={getPlayerAvatar}
                  compact={variant === "tv"}
                  strip={variant === "tv"}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/** All stacks for the player monitor preview — vertical list, no horizontal scroll. */
export function PlayerStackPreview({
  stackOrder,
  players,
  matches,
  courts,
}: {
  stackOrder: string[];
  players: Player[];
  matches: Match[];
  courts: Court[];
}) {
  const allGroups = getTvStackGroups(stackOrder, players, matches, courts, MAX_STACKS);

  return (
    <div className="mt-3 rounded-xl bg-ivory p-3 text-forest">
      <div className="flex items-center justify-between gap-2 text-clay">
        <span className="text-[9px] font-black uppercase tracking-normal">Tonight&apos;s stacks</span>
        <span className="text-[9px] font-black tabular-nums text-forest/50">
          {allGroups.length || 0} / {MAX_STACKS}
        </span>
      </div>

      {allGroups.length === 0 ? (
        <p className="py-3 text-center text-xs font-bold text-forest/60">No stacks queued yet</p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
          {allGroups.map((group, index) => {
            const names = group
              .filter((item) => !item.isVacant)
              .map((item) => getPlayerDisplayLabel(item));
            const vacantCount = group.filter((item) => item.isVacant).length;
            return (
              <li
                key={group.map((p) => p.id).join("-") || `stack-${index}`}
                className={`rounded-lg px-2.5 py-2 ${
                  index === 0 ? "bg-brass/25 ring-1 ring-brass/40" : "bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-black uppercase tracking-normal text-forest">
                    {getStackLabel(index)}
                  </p>
                  <span className="text-[9px] font-black tabular-nums text-forest/50">
                    {names.length}/4
                  </span>
                </div>
                <p className="mt-1 break-words text-xs font-black leading-snug text-forest">
                  {names.length > 0 ? names.join(" · ") : "Waiting for players"}
                </p>
                {vacantCount > 0 && names.length > 0 ? (
                  <p className="mt-0.5 text-[10px] font-semibold text-forest/55">
                    {vacantCount} open slot{vacantCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
