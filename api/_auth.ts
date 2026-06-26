import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";

const COOKIE_NAME = "__Secure-haff_session";
const LEGACY_COOKIE_NAME = "haff_session";
const SESSION_DAYS = 30;

function sessionCookie(req: VercelRequest, value: string, maxAgeSeconds: number) {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  const domainPart = domain ? `; Domain=${domain}` : "";
  const host = req.headers.host || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const isSecure = (req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production") && !isLocalhost;
  const securePart = isSecure ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax${securePart}; Max-Age=${maxAgeSeconds}${domainPart}`;
}

function legacySessionCookie(req: VercelRequest, value: string, maxAgeSeconds: number) {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  const domainPart = domain ? `; Domain=${domain}` : "";
  const host = req.headers.host || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const isSecure = (req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production") && !isLocalhost;
  const securePart = isSecure ? "; Secure" : "";
  return `${LEGACY_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax${securePart}; Max-Age=${maxAgeSeconds}${domainPart}`;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function cookieValue(req: VercelRequest) {
  const cookie = req.headers.cookie ?? "";
  const values = cookie
    .split(";")
    .map((part) => part.trim().split("="));
  return values.find(([name]) => name === COOKIE_NAME)?.[1]
    ?? values.find(([name]) => name === LEGACY_COOKIE_NAME)?.[1];
}

export async function createSession(req: VercelRequest, userId: string, res: VercelResponse) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const tokenHash = hashToken(token);
  try {
    await dbQuery(
      `INSERT INTO "AuthSession" (id, "userId", "tokenHash", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, $4, NOW())`,
      [randomUUID(), userId, tokenHash, expiresAt.toISOString()]
    );
  } catch (error) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw error;
    const { error: insertError } = await supabase.from("AuthSession").insert({
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt: expiresAt.toISOString()
    });
    if (insertError) throw insertError;
  }
  res.setHeader("Set-Cookie", [
    sessionCookie(req, token, SESSION_DAYS * 86400),
    legacySessionCookie(req, token, SESSION_DAYS * 86400)
  ]);
}

export async function clearSession(req: VercelRequest, res?: VercelResponse) {
  const token = cookieValue(req);
  if (token) {
    await dbQuery(`DELETE FROM "AuthSession" WHERE "tokenHash" = $1`, [hashToken(token)]).catch(async () => {
      const supabase = getSupabaseAdmin();
      if (supabase) await supabase.from("AuthSession").delete().eq("tokenHash", hashToken(token));
    });
  }
  if (res) {
    res.setHeader("Set-Cookie", [
      sessionCookie(req, "", 0),
      legacySessionCookie(req, "", 0)
    ]);
  }
}

export async function getUser(req: VercelRequest) {
  const token = cookieValue(req);
  if (!token) return null;

  type UserRow = {
    id: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    status: string;
    playerId: string | null;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
    displayName: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    avatarVersion: number | null;
    skillLevel: string | null;
    rating: number | null;
    tags: string[] | null;
    playerStatus: string | null;
    playerEmail: string | null;
  };

  let rows: UserRow[] = [];
  try {
    const result = await dbQuery<UserRow>(
      `SELECT u.id, u.email, u.role, u.status, u."playerId", u."passwordHash", u."createdAt", u."updatedAt",
              p."displayName", p."fullName", p."avatarUrl", p."avatarVersion", p."skillLevel",
              p.rating, p.tags, p.status AS "playerStatus", p.email AS "playerEmail"
       FROM "AuthSession" s
       JOIN "User" u ON u.id = s."userId"
       LEFT JOIN "Player" p ON p.id = u."playerId"
       WHERE s."tokenHash" = $1
         AND s."expiresAt" > NOW()
       LIMIT 1`,
      [hashToken(token)]
    );
    rows = result.rows;
  } catch {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data: session } = await supabase
      .from("AuthSession")
      .select("userId")
      .eq("tokenHash", hashToken(token))
      .gt("expiresAt", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (!session?.userId) return null;
    const { data: user } = await supabase
      .from("User")
      .select("id, email, role, status, playerId, passwordHash, createdAt, updatedAt")
      .eq("id", session.userId)
      .limit(1)
      .maybeSingle();
    if (!user) return null;
    let player: any = null;
    if (user.playerId) {
      const { data } = await supabase
        .from("Player")
        .select("displayName, fullName, avatarUrl, avatarVersion, skillLevel, rating, tags, status, email")
        .eq("id", user.playerId)
        .limit(1)
        .maybeSingle();
      player = data;
    }
    rows = [{
      ...user,
      displayName: player?.displayName ?? null,
      fullName: player?.fullName ?? null,
      avatarUrl: player?.avatarUrl ?? null,
      avatarVersion: player?.avatarVersion ?? null,
      skillLevel: player?.skillLevel ?? null,
      rating: player?.rating ?? null,
      tags: player?.tags ?? null,
      playerStatus: player?.status ?? null,
      playerEmail: player?.email ?? null
    } as UserRow];
  }

  const userRow = rows[0];
  if (!userRow || userRow.status !== 'ACTIVE') return null;
  const hasPlayer = Boolean(userRow.playerId && userRow.displayName);
  
  return {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    status: userRow.status,
    playerId: userRow.playerId,
    passwordHash: userRow.passwordHash,
    createdAt: userRow.createdAt,
    updatedAt: userRow.updatedAt,
    player: hasPlayer ? {
      id: userRow.playerId!,
      displayName: userRow.displayName!,
      fullName: userRow.fullName,
      avatarUrl: userRow.avatarUrl,
      avatarVersion: userRow.avatarVersion,
      skillLevel: userRow.skillLevel,
      rating: userRow.rating,
      tags: userRow.tags,
      status: userRow.playerStatus,
      email: userRow.playerEmail
    } : undefined
  };
}

export async function requireUser(req: VercelRequest, res: VercelResponse) {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return user;
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return user;
}

export function publicUser(user: Awaited<ReturnType<typeof getUser>>) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    playerId: user.playerId,
    // Flatten key player fields so SessionMember type is satisfied
    displayName: user.player?.displayName ?? user.email.split("@")[0],
    avatarUrl: user.player?.avatarUrl ?? null,
    skillLevel: user.player?.skillLevel ?? null,
    player: user.player ?? null,
  };
}
