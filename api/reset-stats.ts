import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";
import { requireAdmin } from "./_auth.js";
import { audit } from "./_audit.js";

/**
 * POST /api/reset-stats
 *
 * Authenticated endpoint — only admins.
 * Resets all player performance stats to 0, deletes matches, resets courts,
 * and resets the default active session settings.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // requireAdmin already sent 401/403

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Database not configured" });

  try {
    // 1. Reset player stats to 0
    const { error: playerError } = await supabase
      .from("Player")
      .update({
        totalGamesPlayed: 0,
        totalPointsScored: 0,
        totalPointsAgainst: 0,
        totalDaysPlayed: 0,
        currentPlayDayStreak: 0,
        bestPlayDayStreak: 0,
        totalCourtSeconds: 0,
        lastPlayedDate: null
      })
      .neq("id", "");

    if (playerError) throw playerError;

    // 2. Clear matches
    const { error: matchError } = await supabase
      .from("Match")
      .delete()
      .neq("id", "");

    if (matchError) throw matchError;

    // 3. Reset courts
    const { data: courts, error: courtsGetError } = await supabase
      .from("Court")
      .select("*")
      .order("number", { ascending: true });

    if (courtsGetError) throw courtsGetError;

    const { error: courtUpdateError } = await supabase
      .from("Court")
      .update({
        status: "Available",
        currentMatchId: null,
        nextMatchId: null,
        notes: null
      })
      .neq("id", "");

    if (courtUpdateError) throw courtUpdateError;

    // 4. Update session
    const SESSION_ID = "default-active-session";
    const { data: existingSession } = await supabase
      .from("Session")
      .select("*")
      .eq("id", SESSION_ID)
      .maybeSingle();

    const courtSettings = (courts || []).map((court) => ({
      id: court.id,
      name: court.name,
      number: court.number,
      status: "Available",
      priority: court.number,
      reservable: true
    }));

    const priorSettings = existingSession?.settings || {};
    const {
      playerKudos: _k,
      matchReviews: _r,
      playerProfiles: _p,
      ...restSettings
    } = priorSettings;

    const settings = {
      ...restSettings,
      adminCheckedInIds: [],
      stackOrder: [],
      courts: courtSettings,
      matches: [],
      tvBroadcast: null
    };

    const { error: sessionError } = await supabase
      .from("Session")
      .upsert({
        id: SESSION_ID,
        name: "Open Play Session",
        date: new Date().toISOString(),
        mode: "Open Play",
        status: "Active",
        checkedInPlayerIds: [],
        settings
      });

    if (sessionError) throw sessionError;

    // Log the action to audit logs
    await audit(admin.id, "GAME_STATS_RESET", "Player", "*", {
      resetBy: admin.email
    });

    return res.status(200).json({
      success: true,
      message: "All player game statistics, matches, and session states have been reset."
    });
  } catch (err: any) {
    console.error("Error resetting stats:", err);
    return res.status(500).json({ error: err.message || "Failed to reset stats" });
  }
}
