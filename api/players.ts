import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const players = await prisma.player.findMany({
      orderBy: { displayName: "asc" }
    });
    return res.status(200).json({ status: "success", count: players.length, players });
  } catch (error) {
    console.error("Failed to fetch players", error);
    return res.status(500).json({ status: "error", message: "Failed to fetch players" });
  }
}
