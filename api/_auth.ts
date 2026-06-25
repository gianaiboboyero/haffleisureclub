import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";

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

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

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
  await dbQuery(
    `INSERT INTO "AuthSession" (id, "userId", "tokenHash", "expiresAt", "createdAt")
     VALUES ($1, $2, $3, $4, NOW())`,
    [randomUUID(), userId, hashToken(token), expiresAt.toISOString()]
  );
  res.setHeader("Set-Cookie", [
    sessionCookie(req, token, SESSION_DAYS * 86400),
    legacySessionCookie(req, token, SESSION_DAYS * 86400)
  ]);
}

export async function clearSession(req: VercelRequest, res: VercelResponse) {
  const token = cookieValue(req);
  if (token) {
    await dbQuery(`DELETE FROM "AuthSession" WHERE "tokenHash" = $1`, [hashToken(token)]).catch(() => {});
  }
  res.setHeader("Set-Cookie", [
    sessionCookie(req, "", 0),
    legacySessionCookie(req, "", 0)
  ]);
}

export async function getUser(req: VercelRequest) {
  const token = cookieValue(req);
  if (!token) return null;
  const { rows } = await dbQuery(
    `SELECT
       u.id, u.email, u.role, u.status, u."playerId", u."passwordHash", u."createdAt", u."updatedAt",
       p.id as "_pid", p."displayName", p."fullName", p."avatarUrl", p."avatarVersion",
       p."skillLevel", p.rating, p.tags, p.status as "_pstatus", p.email as "_pemail"
     FROM "AuthSession" s
     JOIN "User" u ON u.id = s."userId"
     LEFT JOIN "Player" p ON p.id = u."playerId"
     WHERE s."tokenHash" = $1 AND s."expiresAt" > NOW() AND u.status = 'ACTIVE'`,
    [hashToken(token)]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    playerId: r.playerId,
    passwordHash: r.passwordHash,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    player: r._pid ? {
      id: r._pid,
      displayName: r.displayName,
      fullName: r.fullName,
      avatarUrl: r.avatarUrl,
      avatarVersion: r.avatarVersion,
      skillLevel: r.skillLevel,
      rating: r.rating,
      tags: r.tags,
      status: r._pstatus,
      email: r._pemail,
    } : null,
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

export function publicUser(user: Awaited<ReturnType<typeof getUser>>) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    playerId: user.playerId,
    player: user.player ?? null,
  };
}
