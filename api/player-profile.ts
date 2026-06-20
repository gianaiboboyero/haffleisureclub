import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireUser } from "./_auth.js";
import { audit } from "./_audit.js";
import { uploadPlayerAvatarServer } from "./_supabaseAdmin.js";
import { isAllowedAvatarUrl, isProductionEnv } from "./_security.js";

const SKILL_LEVELS = new Set([
  "Newbie",
  "Beginner",
  "Novice",
  "Low Intermediate",
  "Intermediate",
  "Pro"
]);

function normalizeSkillLevel(value: unknown) {
  const skill = String(value ?? "Beginner").trim();
  return SKILL_LEVELS.has(skill) ? skill : "Beginner";
}

function isInlineAvatarData(value: unknown) {
  return typeof value === "string" && value.startsWith("data:image");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    res.setHeader("Allow", "PATCH, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const actor = await requireUser(req, res);
  if (!actor) return;

  const playerId = String(req.body?.id ?? req.body?.playerId ?? "").trim();
  if (!playerId) return res.status(400).json({ error: "Player id is required." });

  const isAdmin = actor.role === "ADMIN";
  if (!isAdmin && actor.playerId !== playerId) {
    return res.status(403).json({ error: "You can only update your own profile." });
  }

  const current = await prisma.player.findUnique({ where: { id: playerId } });
  if (!current) return res.status(404).json({ error: "Player not found." });

  const displayName = String(req.body?.displayName ?? current.displayName).trim();
  if (displayName.length < 1 || displayName.length > 120) {
    return res.status(400).json({ error: "Display name must be 1–120 characters." });
  }

  const statsPatch =
    typeof req.body?.totalGamesPlayed === "number" ||
    typeof req.body?.totalDaysPlayed === "number" ||
    req.body?.lastPlayedDate !== undefined;

  if (statsPatch && !isAdmin) {
    return res.status(403).json({ error: "Administrator access required to update player stats." });
  }

  if (statsPatch && isAdmin && playerId !== actor.playerId) {
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        totalGamesPlayed:
          typeof req.body?.totalGamesPlayed === "number"
            ? Math.max(0, Math.floor(req.body.totalGamesPlayed))
            : current.totalGamesPlayed,
        totalDaysPlayed:
          typeof req.body?.totalDaysPlayed === "number"
            ? Math.max(0, Math.floor(req.body.totalDaysPlayed))
            : current.totalDaysPlayed,
        lastPlayedDate:
          typeof req.body?.lastPlayedDate === "string" && req.body.lastPlayedDate
            ? new Date(req.body.lastPlayedDate)
            : req.body?.lastPlayedDate === null
              ? null
              : current.lastPlayedDate,
        version: { increment: 1 }
      }
    });
    await audit(actor.id, "PLAYER_STATS_UPDATED", "Player", playerId);
    return res.status(200).json({
      player: {
        id: updated.id,
        displayName: updated.displayName,
        fullName: updated.fullName,
        skillLevel: updated.skillLevel,
        rating: updated.rating,
        avatarUrl: updated.avatarUrl,
        statusNote: updated.statusNote,
        phone: updated.phone,
        tags: updated.tags,
        status: updated.status,
        totalGamesPlayed: updated.totalGamesPlayed,
        totalDaysPlayed: updated.totalDaysPlayed,
        lastPlayedDate: updated.lastPlayedDate?.toISOString() ?? null,
        version: updated.version,
        updatedAt: updated.updatedAt.toISOString()
      }
    });
  }

  let avatarUrl = typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl.trim() : current.avatarUrl;
  let avatarVersion = current.avatarVersion;
  const avatarDataUrl = req.body?.avatarDataUrl;

  const supabaseBase =
    process.env.SUPABASE_URL?.trim()
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    ?? "";
  if (
    avatarUrl
    && !isInlineAvatarData(avatarDataUrl)
    && !isInlineAvatarData(avatarUrl)
    && !isAllowedAvatarUrl(avatarUrl, supabaseBase)
  ) {
    return res.status(400).json({ error: "Avatar URL must be hosted in club storage." });
  }

  if (isInlineAvatarData(avatarDataUrl)) {
    try {
      const uploaded = await uploadPlayerAvatarServer(playerId, avatarDataUrl);
      avatarUrl = uploaded.avatarUrl;
      avatarVersion = uploaded.avatarVersion;
    } catch (error) {
      console.error("Avatar upload failed", error);
      const message = isProductionEnv()
        ? "Avatar upload failed."
        : error instanceof Error
          ? error.message
          : "Avatar upload failed.";
      return res.status(400).json({ error: message });
    }
  }

  const data: Record<string, unknown> = {
    displayName,
    fullName:
      typeof req.body?.fullName === "string" && req.body.fullName.trim()
        ? req.body.fullName.trim()
        : current.fullName,
    skillLevel: normalizeSkillLevel(req.body?.skillLevel ?? current.skillLevel),
    avatarUrl: avatarUrl || null,
    avatarVersion,
    statusNote:
      typeof req.body?.statusNote === "string" && req.body.statusNote.trim()
        ? req.body.statusNote.trim()
        : req.body?.statusNote === null || req.body?.statusNote === ""
          ? null
          : current.statusNote
  };

  if (isAdmin) {
    if (typeof req.body?.rating === "number") data.rating = Math.min(10, Math.max(0, req.body.rating));
    if (typeof req.body?.phoneNumber === "string") data.phone = req.body.phoneNumber.trim() || null;
    if (Array.isArray(req.body?.tags)) data.tags = req.body.tags.map(String);
    if (req.body?.isActive === false || req.body?.status === "Inactive") data.status = "Inactive";
    if (req.body?.isActive === true || req.body?.status === "Active") data.status = "Active";
    if (typeof req.body?.totalGamesPlayed === "number") {
      data.totalGamesPlayed = Math.max(0, Math.floor(req.body.totalGamesPlayed));
    }
    if (typeof req.body?.totalDaysPlayed === "number") {
      data.totalDaysPlayed = Math.max(0, Math.floor(req.body.totalDaysPlayed));
    }
    if (typeof req.body?.lastPlayedDate === "string") {
      data.lastPlayedDate = req.body.lastPlayedDate ? new Date(req.body.lastPlayedDate) : null;
    }
    if (typeof req.body?.nickname === "string") data.nickname = req.body.nickname.trim() || null;
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: { ...data, version: { increment: 1 } }
  });

  await audit(actor.id, "PLAYER_PROFILE_UPDATED", "Player", playerId, { admin: isAdmin });

  return res.status(200).json({
    player: {
      id: updated.id,
      displayName: updated.displayName,
      fullName: updated.fullName,
      skillLevel: updated.skillLevel,
      rating: updated.rating,
      avatarUrl: updated.avatarUrl,
      avatarVersion: updated.avatarVersion,
      statusNote: updated.statusNote,
      phone: updated.phone,
      tags: updated.tags,
      status: updated.status,
      totalGamesPlayed: updated.totalGamesPlayed,
      totalDaysPlayed: updated.totalDaysPlayed,
      lastPlayedDate: updated.lastPlayedDate?.toISOString() ?? null,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString()
    }
  });
}
