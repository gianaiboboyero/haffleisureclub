import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireUser } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!user.playerId) return res.status(200).json({ recap: null });

  const matches = await prisma.match.findMany({
    where: {
      status: "Completed",
      OR: [
        { teamAPlayerIds: { has: user.playerId } },
        { teamBPlayerIds: { has: user.playerId } }
      ]
    },
    orderBy: { endedAt: "desc" }
  });
  let wins = 0;
  const people = new Set<string>();
  const courts = new Set<string>();
  let seconds = 0;
  for (const match of matches) {
    const onA = match.teamAPlayerIds.includes(user.playerId);
    if ((onA && match.scoreA > match.scoreB) || (!onA && match.scoreB > match.scoreA)) wins += 1;
    [...match.teamAPlayerIds, ...match.teamBPlayerIds]
      .filter((id) => id !== user.playerId)
      .forEach((id) => people.add(id));
    if (match.courtId) courts.add(match.courtId);
    seconds += match.durationSeconds ?? (
      match.startedAt && match.endedAt
        ? Math.max(0, Math.floor((match.endedAt.getTime() - match.startedAt.getTime()) / 1000))
        : 0
    );
  }
  return res.status(200).json({
    recap: {
      displayName: user.player?.displayName ?? user.email.split("@")[0],
      totalGames: matches.length,
      wins,
      activeSeconds: seconds,
      uniquePlayers: people.size,
      courtsPlayed: courts.size,
      totalDaysPlayed: user.player?.totalDaysPlayed ?? 0,
      totalGamesPlayed: user.player?.totalGamesPlayed ?? matches.length
    }
  });
}
