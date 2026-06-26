import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    const { rows } = await dbQuery(
      `SELECT id, name, number, status, "currentMatchId", "nextMatchId",
              notes, version, "updatedAt"
       FROM "Court"
       ORDER BY number ASC`
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("/api/courts failed", error);
    return res.status(500).json({ error: "Failed to load courts." });
  }
}
