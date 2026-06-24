import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
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
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");
  await supabase.from("AuthSession").insert({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: expiresAt.toISOString()
  });
  res.setHeader("Set-Cookie", [
    sessionCookie(req, token, SESSION_DAYS * 86400),
    legacySessionCookie(req, token, SESSION_DAYS * 86400)
  ]);
}

export async function clearSession(req: VercelRequest, res: VercelResponse) {
  const token = cookieValue(req);
  if (token) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from("AuthSession").delete().eq("tokenHash", hashToken(token));
    }
  }
  res.setHeader("Set-Cookie", [
    sessionCookie(req, "", 0),
    legacySessionCookie(req, "", 0)
  ]);
}

export async function getUser(req: VercelRequest) {
  const token = cookieValue(req);
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data: session } = await supabase
    .from("AuthSession")
    .select('*, user:User(*, player:Player(*))')
    .eq("tokenHash", hashToken(token))
    .single();

  if (!session || new Date(session.expiresAt) <= new Date() || session.user?.status !== "ACTIVE") return null;
  return session.user;
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
    res.status(403).json({ error: "Administrator access required" });
    return null;
  }
  return user;
}

export const publicUser = (user: Awaited<ReturnType<typeof getUser>>) =>
  user
    ? {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.player?.displayName ?? user.email.split("@")[0],
        playerId: user.playerId,
        avatarUrl: user.player?.avatarUrl ?? null,
        skillLevel: user.player?.skillLevel ?? null
      }
    : null;
