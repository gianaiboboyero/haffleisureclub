import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, uploadPlayerAvatarServer } from "./_supabaseAdmin.js";
import { requireUser } from "./_auth.js";
import { audit } from "./_audit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── PATCH /api/player-profile — update own profile (name, skill, status, avatar) ──
  if (req.method === "PATCH") {
    const user = await requireUser(req, res);
    if (!user) return;

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: "Database not configured." });

    const {
      id,
      displayName,
      fullName,
      skillLevel,
      statusNote,
      phoneNumber,
      tags,
      avatarDataUrl,
      avatarUrl,
    } = req.body ?? {};

    // Users can only update their own player record unless they're an admin
    const targetId = String(id ?? "");
    if (!targetId) return res.status(400).json({ error: "Player ID is required." });
    if (user.role !== "ADMIN" && user.playerId !== targetId) {
      return res.status(403).json({ error: "You can only update your own profile." });
    }

    const patch: Record<string, unknown> = {};
    if (displayName !== undefined) patch.displayName = String(displayName).trim().slice(0, 60);
    if (fullName !== undefined) patch.fullName = String(fullName).trim().slice(0, 120) || null;
    if (skillLevel !== undefined) patch.skillLevel = String(skillLevel);
    if (statusNote !== undefined) patch.statusNote = String(statusNote ?? "").trim().slice(0, 200) || null;
    if (phoneNumber !== undefined) patch.phone = String(phoneNumber ?? "").trim() || null;
    if (Array.isArray(tags)) patch.tags = tags.map(String).slice(0, 20);

    // Handle avatar: prefer fresh data-URL upload, else keep existing URL
    let resolvedAvatarUrl: string | undefined;
    if (avatarDataUrl && typeof avatarDataUrl === "string" && avatarDataUrl.startsWith("data:image")) {
      try {
        const { avatarUrl: uploaded, avatarVersion } = await uploadPlayerAvatarServer(targetId, avatarDataUrl);
        patch.avatarUrl = uploaded;
        patch.avatarVersion = avatarVersion;
        resolvedAvatarUrl = uploaded;
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : "Avatar upload failed." });
      }
    } else if (avatarUrl !== undefined) {
      patch.avatarUrl = String(avatarUrl) || null;
    }

    const { data: updated, error } = await supabase
      .from("Player")
      .update({ ...patch, updatedAt: new Date().toISOString() })
      .eq("id", targetId)
      .select("id, displayName, fullName, skillLevel, rating, avatarUrl, statusNote, phone, tags, status, totalGamesPlayed, totalCourtSeconds, totalDaysPlayed, lastPlayedDate, version")
      .single();

    if (error || !updated) {
      return res.status(500).json({ error: "Failed to update profile." });
    }
    await audit(user.id, "PLAYER_PROFILE_UPDATE", "Player", targetId);
    return res.status(200).json({ player: updated });
  }

  // ── POST /api/player-profile — bulk stats update after matches ──
  if (req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;

    const { action, players } = req.body ?? {};

    if (action !== "bulk-stats" || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "Invalid request." });
    }
    if (players.length > 50) {
      return res.status(400).json({ error: "Too many players in one request (max 50)." });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: "Database not configured." });

    // Only admins or the player themselves can post stats
    if (user.role !== "ADMIN") {
      const ids = players.map((p: Record<string, unknown>) => String(p.id));
      if (ids.some((id) => id !== user.playerId)) {
        return res.status(403).json({ error: "Cannot update stats for other players." });
      }
    }

    const updates = (players as Record<string, unknown>[]).map((p) => ({
      id: String(p.id),
      totalGamesPlayed: Number(p.totalGamesPlayed) || 0,
      totalCourtSeconds: Number(p.totalCourtSeconds) || 0,
      totalDaysPlayed: Number(p.totalDaysPlayed) || 0,
      lastPlayedDate: p.lastPlayedDate ? String(p.lastPlayedDate) : null,
      updatedAt: new Date().toISOString(),
    }));

    const { error } = await supabase.from("Player").upsert(updates, { onConflict: "id" });
    if (error) return res.status(500).json({ error: "Failed to update stats." });

    return res.status(200).json({ updated: updates.length });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
