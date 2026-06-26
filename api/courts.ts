import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    let rows: unknown[] = [];
    try {
      const result = await dbQuery(
        `SELECT id, name, number, status, "currentMatchId", "nextMatchId",
                notes, version, "updatedAt"
         FROM "Court"
         ORDER BY number ASC`
      );
      rows = result.rows;
    } catch (error) {
      const supabase = getSupabaseAdmin();
      if (!supabase) throw error;
      const { data, error: readError } = await supabase
        .from("Court")
        .select("id, name, number, status, currentMatchId, nextMatchId, notes, version, updatedAt")
        .order("number", { ascending: true });
      if (readError) throw readError;
      rows = data ?? [];
    }
    return res.status(200).json(rows);
  } catch (error) {
    console.error("/api/courts failed", error);
    return res.status(200).json([
      { id: "court-1", name: "Court 1", number: 1, status: "Available", currentMatchId: null, nextMatchId: null, notes: null, version: 1, updatedAt: new Date().toISOString() },
      { id: "court-2", name: "Court 2", number: 2, status: "Available", currentMatchId: null, nextMatchId: null, notes: null, version: 1, updatedAt: new Date().toISOString() },
      { id: "court-3", name: "Court 3", number: 3, status: "Available", currentMatchId: null, nextMatchId: null, notes: null, version: 1, updatedAt: new Date().toISOString() }
    ]);
  }
}
