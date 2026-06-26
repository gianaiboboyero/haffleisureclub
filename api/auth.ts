import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";
import { dbQuery } from "./_db.js";
import {
  clearSession,
  createSession,
  getUser,
  hashPassword,
  publicUser,
  verifyPassword
} from "./_auth.js";
import { audit } from "./_audit.js";
import {
  loginFailureBucket,
  MAX_LOGIN_FAILURES,
  LOGIN_FAILURE_WINDOW_MS,
  passwordValidationMessage,
  validPassword
} from "./_security.js";

const LOGIN_RATE_LIMIT_TIMEOUT_MS = 1200;

async function fetchAdminWriteToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("AdminConfig").select("value").eq("key", "write_token").limit(1).single();
  return data?.value ?? null;
}

async function recentLoginFailureCount(bucket: string): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGIN_RATE_LIMIT_TIMEOUT_MS);
  try {
    const timeWindow = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS).toISOString();
    const { count, error } = await supabase.from("AuditLog")
      .select("id", { count: "exact", head: true })
      .eq("action", "AUTH_LOGIN_FAILED")
      .eq("entityId", bucket)
      .gt("createdAt", timeWindow)
      .abortSignal(controller.signal);
    if (error) return null;
    return count;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findUserForLogin(email: string) {
  type LoginRow = {
    id: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    status: string;
    playerId: string | null;
    passwordHash: string;
    displayName: string | null;
    avatarUrl: string | null;
    avatarVersion: number | null;
    skillLevel: string | null;
    rating: number | null;
    tags: string[] | null;
    playerStatus: string | null;
  };

  let rows: LoginRow[] = [];
  try {
    const result = await dbQuery<LoginRow>(
      `SELECT u.id, u.email, u.role, u.status, u."playerId", u."passwordHash",
              p."displayName", p."avatarUrl", p."avatarVersion", p."skillLevel",
              p.rating, p.tags, p.status AS "playerStatus"
       FROM "User" u
       LEFT JOIN "Player" p ON p.id = u."playerId"
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    rows = result.rows;
  } catch {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data: user } = await supabase
      .from("User")
      .select("id, email, role, status, playerId, passwordHash")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (!user) return null;
    let player: any = null;
    if (user.playerId) {
      const { data } = await supabase
        .from("Player")
        .select("displayName, avatarUrl, avatarVersion, skillLevel, rating, tags, status")
        .eq("id", user.playerId)
        .limit(1)
        .maybeSingle();
      player = data;
    }
    rows = [{
      ...user,
      displayName: player?.displayName ?? null,
      avatarUrl: player?.avatarUrl ?? null,
      avatarVersion: player?.avatarVersion ?? null,
      skillLevel: player?.skillLevel ?? null,
      rating: player?.rating ?? null,
      tags: player?.tags ?? null,
      playerStatus: player?.status ?? null
    } as LoginRow];
  }
  return rows[0] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: "Database not configured." });
  }

  if (req.method === "GET" && action === "me") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const user = await getUser(req);
    const userJson = publicUser(user);
    if (userJson && user?.role === "ADMIN") {
      (userJson as any).adminWriteToken = await fetchAdminWriteToken();
    }
    return res.status(200).json({ user: userJson });
  }

  if (req.method === "POST" && action === "register") {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const displayName = String(req.body?.displayName ?? "").trim();
    const skillLevel = String(req.body?.skillLevel ?? "Beginner");
    if (!email.includes("@") || !validPassword(password) || displayName.length < 2) {
      return res.status(400).json({ error: `Use a valid name, email, and ${passwordValidationMessage().toLowerCase()}` });
    }

    const { data: existing } = await supabase.from("User").select("id").eq("email", email).limit(1).maybeSingle();
    if (existing) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL ? process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase() : null;
    const playerId = randomUUID();
    const userId = randomUUID();

    const { error: playerError } = await supabase.from("Player").insert({
      id: playerId,
      displayName,
      fullName: displayName,
      email,
      skillLevel,
      rating: 2,
      tags: ['Member'],
      version: 1
    });
    if (playerError) {
      return res.status(500).json({ error: "Failed to create player record." });
    }

    const role = adminEmail && email === adminEmail ? "ADMIN" : "MEMBER";
    const { data: userRow, error: userError } = await supabase.from("User").insert({
      id: userId,
      email,
      passwordHash: hashPassword(password),
      role,
      playerId
    }).select("id, email, role, status, playerId").single();
    
    if (userError || !userRow) {
      return res.status(500).json({ error: "Failed to create user record." });
    }

    const user = { ...userRow, player: { id: playerId, displayName, email, skillLevel } };
    await createSession(req, userId, res);
    await audit(userId, "AUTH_REGISTER", "User", userId);
    return res.status(201).json({ user: publicUser(user as any) });
  }

  if (req.method === "POST" && action === "login") {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0];
    const bucket = loginFailureBucket(email, ip);

    const count = await recentLoginFailureCount(bucket);
    if (count !== null && count >= MAX_LOGIN_FAILURES) {
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }

    const row = await findUserForLogin(email);

    if (!row || !verifyPassword(password, row.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (row.status !== "ACTIVE") {
      return res.status(403).json({ error: "This account has been suspended or deactivated." });
    }
    
    if (row.playerId && String(row.playerStatus ?? "").toUpperCase() !== "ACTIVE") {
      return res.status(403).json({ error: "The associated player profile is not active." });
    }

    const user = {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      playerId: row.playerId,
      player: row.playerId ? {
        id: row.playerId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        avatarVersion: row.avatarVersion,
        skillLevel: row.skillLevel,
        rating: row.rating,
        tags: row.tags,
        status: row.playerStatus
      } : undefined
    };

    await createSession(req, user.id, res);
    return res.status(200).json({ user: publicUser(user as any) });
  }

  if (req.method === "POST" && action === "logout") {
    const user = await getUser(req);
    await clearSession(req, res);
    if (user) await audit(user.id, "AUTH_LOGOUT", "User", user.id);
    return res.status(200).json({ success: true });
  }

  if (req.method === "POST" && action === "change-password") {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const currentPassword = String(req.body?.currentPassword ?? "");
    const nextPassword = String(req.body?.newPassword ?? "");
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }
    if (!validPassword(nextPassword)) {
      return res.status(400).json({ error: passwordValidationMessage() });
    }
    const nextHash = hashPassword(nextPassword);
    try {
      await dbQuery(
        `UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`,
        [nextHash, user.id]
      );
      await dbQuery(`DELETE FROM "AuthSession" WHERE "userId" = $1`, [user.id]);
    } catch {
      const supabase = getSupabaseAdmin();
      if (!supabase) throw new Error("Database not configured.");
      await supabase.from("User").update({ passwordHash: nextHash }).eq("id", user.id);
      await supabase.from("AuthSession").delete().eq("userId", user.id);
    }
    await createSession(req, user.id, res);
    await audit(user.id, "AUTH_PASSWORD_CHANGED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  if (req.method === "POST" && action === "revoke-sessions") {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    await dbQuery(`DELETE FROM "AuthSession" WHERE "userId" = $1`, [user.id]).catch(async () => {
      const supabase = getSupabaseAdmin();
      if (supabase) await supabase.from("AuthSession").delete().eq("userId", user.id);
    });
    await clearSession(req, res);
    await audit(user.id, "AUTH_SESSIONS_REVOKED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown auth action" });
}
