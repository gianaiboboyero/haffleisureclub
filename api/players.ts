import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";
import { getCurrentSupabasePublic, getSupabaseAdmin } from "./_supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    let rows: unknown[] = [];
    try {
      const { data, error: readError } = await getCurrentSupabasePublic()
        .from("Player")
        .select("id, displayName, fullName, skillLevel, rating, avatarUrl, tags, status, totalGamesPlayed, totalCourtSeconds, totalDaysPlayed, lastPlayedDate, version, updatedAt")
        .order("displayName", { ascending: true });
      if (readError) throw readError;
      rows = data ?? [];
    } catch {
      try {
        const result = await dbQuery(
          `SELECT id, "displayName", "fullName", "skillLevel", rating, "avatarUrl",
                  tags, status, "totalGamesPlayed", "totalCourtSeconds", "totalDaysPlayed",
                  "lastPlayedDate", version, "updatedAt"
           FROM "Player"
           ORDER BY "displayName" ASC`
        );
        rows = result.rows;
      } catch (error) {
      const supabase = getSupabaseAdmin();
      if (!supabase) throw error;
      const { data, error: readError } = await supabase
        .from("Player")
        .select("id, displayName, fullName, skillLevel, rating, avatarUrl, tags, status, totalGamesPlayed, totalCourtSeconds, totalDaysPlayed, lastPlayedDate, version, updatedAt")
        .order("displayName", { ascending: true });
      if (readError) throw readError;
      rows = data ?? [];
      }
    }
    return res.status(200).json(rows);
  } catch (error) {
    console.error("/api/players failed", error);
    return res.status(200).json([]);
  }
}
