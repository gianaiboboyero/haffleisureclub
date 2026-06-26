import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    const { rows } = await dbQuery(
      `SELECT id, "displayName", "fullName", "skillLevel", rating, "avatarUrl",
              tags, status, "totalGamesPlayed", "totalCourtSeconds", "totalDaysPlayed",
              "lastPlayedDate", version, "updatedAt"
       FROM "Player"
       ORDER BY "displayName" ASC`
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("/api/players failed", error);
    return res.status(500).json({ error: "Failed to load players." });
  }
}
