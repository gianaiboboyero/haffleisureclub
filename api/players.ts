import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { getUser } from "./_auth.js";
import { publicPlayerDto } from "./_security.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const players = await prisma.player.findMany({
      orderBy: { displayName: "asc" }
    });
    const user = await getUser(req);
    if (user?.role === "ADMIN") {
      return res.status(200).json({ status: "success", count: players.length, players });
    }
    const publicPlayers = players.map((player) => publicPlayerDto(player));
    return res.status(200).json({ status: "success", count: publicPlayers.length, players: publicPlayers });
  } catch (error) {
    console.error("Failed to fetch players", error);
    return res.status(500).json({ status: "error", message: "Failed to fetch players" });
  }
}
