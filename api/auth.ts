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

async function fetchAdminWriteToken(): Promise<string | null> {
  try {
    const { rows } = await dbQuery<{ value: string }>(
      `SELECT value FROM "AdminConfig" WHERE key = 'write_token' LIMIT 1`
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "");

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

    // Check if user already exists
    const { rows: existing } = await dbQuery<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL ? process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase() : null;
    const playerId = randomUUID();
    const userId = randomUUID();

    // Insert player
    const { rows: playerRows } = await dbQuery<{ id: string }>(
      `INSERT INTO "Player" (id, "displayName", "fullName", email, "skillLevel", rating, tags, "updatedAt", "createdAt", "version")
       VALUES ($1, $2, $2, $3, $4, 2, ARRAY['Member'], NOW(), NOW(), 1)
       RETURNING id`,
      [playerId, displayName, email, skillLevel]
    );
    if (!playerRows[0]) {
      return res.status(500).json({ error: "Failed to create player record." });
    }

    // Insert user
    const role = adminEmail && email === adminEmail ? "ADMIN" : "MEMBER";
    const { rows: userRows } = await dbQuery(
      `INSERT INTO "User" (id, email, "passwordHash", role, "playerId", "updatedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, role, status, "playerId"`,
      [userId, email, hashPassword(password), role, playerId]
    );
    if (!userRows[0]) {
      return res.status(500).json({ error: "Failed to create user record." });
    }

    const user = { ...userRows[0], player: { id: playerId, displayName, email, skillLevel } };
    await createSession(req, userId, res);
    await audit(userId, "AUTH_REGISTER", "User", userId);
    return res.status(201).json({ user: publicUser(user as any) });
  }

  if (req.method === "POST" && action === "login") {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0];
    const bucket = loginFailureBucket(email, ip);

    // Check rate limit
    const { rows: [failRow] } = await dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "AuditLog"
       WHERE action = 'AUTH_LOGIN_FAILED' AND "entityId" = $1 AND "createdAt" > $2`,
      [bucket, new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS).toISOString()]
    );
    const recentFailures = parseInt(failRow?.count ?? "0", 10);
    if (recentFailures >= MAX_LOGIN_FAILURES) {
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }

    // Get user with player
    const { rows: userRows } = await dbQuery(
      `SELECT u.id, u.email, u.role, u.status, u."playerId", u."passwordHash",
              p.id as "_pid", p."displayName", p."avatarUrl", p."avatarVersion", p."skillLevel", p.rating, p.tags, p.status as "_pstatus"
       FROM "User" u
       LEFT JOIN "Player" p ON p.id = u."playerId"
       WHERE u.email = $1 LIMIT 1`,
      [email]
    );
    const row = userRows[0];
    if (!row || !verifyPassword(password, row.passwordHash)) {
      await audit(null, "AUTH_LOGIN_FAILED", "LoginAttempt", bucket);
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (row.status !== "ACTIVE") {
      return res.status(403).json({ error: "This account is not active. Please contact a club administrator." });
    }

    const user = {
      id: row.id, email: row.email, role: row.role, status: row.status, playerId: row.playerId,
      player: row._pid ? { id: row._pid, displayName: row.displayName, avatarUrl: row.avatarUrl,
        avatarVersion: row.avatarVersion, skillLevel: row.skillLevel, rating: row.rating, tags: row.tags, status: row._pstatus } : null
    };
    await createSession(req, user.id, res);
    await audit(user.id, "AUTH_LOGIN", "User", user.id);
    const userJson = publicUser(user as any);
    if (userJson && user.role === "ADMIN") {
      (userJson as any).adminWriteToken = await fetchAdminWriteToken();
    }
    return res.status(200).json({ user: userJson });
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
    await dbQuery(
      `UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`,
      [hashPassword(nextPassword), user.id]
    );
    await dbQuery(`DELETE FROM "AuthSession" WHERE "userId" = $1`, [user.id]);
    await createSession(req, user.id, res);
    await audit(user.id, "AUTH_PASSWORD_CHANGED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  if (req.method === "POST" && action === "revoke-sessions") {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    await dbQuery(`DELETE FROM "AuthSession" WHERE "userId" = $1`, [user.id]);
    await clearSession(req, res);
    await audit(user.id, "AUTH_SESSIONS_REVOKED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown auth action" });
}
