import React from "react";
import { GripVertical, ListPlus, LogOut, Users } from "lucide-react";
import { Button, Card } from "./ui";
import type { Court, Match, Player } from "../lib/types";
import {
  getCheckedInPoolPlayers,
  getPlayerAvatar,
  getPlayerStackPlacement,
  isPlayerInQueue,
} from "../lib/utils";

type CheckedInStackProps = {
  players: Player[];
  matches: Match[];
  courts: Court[];
  stackOrder: string[];
  onCheckOut: (playerId: string) => void;
  onCheckOutAll: () => void;
  onAppendToQueue: (playerIds: string[]) => void;
};

export function CheckedInStack({
  players,
  matches,
  courts,
  stackOrder,
  onCheckOut,
  onCheckOutAll,
  onAppendToQueue,
}: CheckedInStackProps) {
  const pool = getCheckedInPoolPlayers(players, matches, courts);
  const notInQueue = pool.filter((player) => !isPlayerInQueue(player.id, stackOrder));

  return (
    <Card className="overflow-hidden bg-white/5 backdrop-blur-xl border border-emerald-500/15 text-ivory">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300/80">Tonight&apos;s players</p>
          <h2 className="font-display text-2xl leading-tight sm:text-3xl text-ivory">Checked-in stack</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-linen/65">
            Everyone here tonight. Drag into queue stacks below to set play order, then use Assign Courts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {notInQueue.length > 0 ? (
            <Button
              onClick={() => onAppendToQueue(notInQueue.map((p) => p.id))}
              className="min-h-9 gap-1.5 bg-emerald-500/15 px-3 text-xs font-black text-emerald-200 hover:bg-emerald-500/25 border border-emerald-500/25"
            >
              <ListPlus size={14} />
              Add {notInQueue.length} to queue
            </Button>
          ) : null}
          {pool.length > 0 ? (
            <Button
              onClick={onCheckOutAll}
              className="min-h-9 gap-1.5 bg-clay/80 px-3 text-xs font-bold text-ivory hover:bg-clay"
            >
              <LogOut size={14} />
              Checkout all
            </Button>
          ) : null}
        </div>
      </div>

      {pool.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-ivory/20" />
          <p className="mt-3 font-semibold text-ivory/70">No one checked in yet</p>
          <p className="mt-1 text-xs text-linen/50">Use the Player Roster to check players in for tonight.</p>
        </div>
      ) : (
        <div
          className="mt-4 flex flex-wrap gap-2.5"
          onDragOver={(event) => event.preventDefault()}
        >
          {pool.map((player) => {
            const placement = getPlayerStackPlacement(player.id, stackOrder);
            const queued = Boolean(placement);
            return (
              <div
                key={player.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/player-id", player.id);
                }}
                className={`flex min-w-[9.5rem] max-w-[11rem] flex-col gap-2 rounded-xl border px-3 py-2.5 cursor-grab active:cursor-grabbing transition hover:brightness-110 ${
                  queued
                    ? "border-brass/30 bg-brass/[0.06]"
                    : "border-emerald-500/25 bg-emerald-500/[0.07]"
                }`}
                title={queued ? `In ${placement!.label} — drag to reorder in queue stacks` : "Not in queue yet — drag into a stack below"}
              >
                <div className="flex items-start gap-2">
                  <GripVertical size={12} className="mt-1 shrink-0 text-ivory/20" />
                  <img
                    src={getPlayerAvatar(player)}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-emerald-500/35 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ivory leading-tight">{player.displayName}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-linen/55">{player.skillLevel}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  {queued ? (
                    <span className="truncate rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-brass">
                      {placement!.label} · #{placement!.slotInGroup}
                    </span>
                  ) : (
                    <span className="truncate rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-200">
                      Awaiting queue
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onCheckOut(player.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-ivory/45 hover:bg-white/10 hover:text-ivory"
                  >
                    Out
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[10px] font-semibold text-linen/45">
        {pool.length} checked in · {notInQueue.length} not in queue · Queue stacks set who plays next
      </p>
    </Card>
  );
}
