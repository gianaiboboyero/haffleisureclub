import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import {
  clearSession,
  createSession,
  getUser,
  hashPassword,
  publicUser,
  verifyPassword
} from "./_auth.js";
import { audit } from "./_audit.js";

const validPassword = (password: string) => password.length > 0;

async function verifyCaptcha(token: unknown, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  const result = await response.json() as { success?: boolean };
  return Boolean(result.success);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "");

  if (req.method === "GET" && action === "me") {
    return res.status(200).json({ user: publicUser(await getUser(req)) });
  }

  if (req.method === "POST" && action === "register") {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const displayName = String(req.body?.displayName ?? "").trim();
    const skillLevel = String(req.body?.skillLevel ?? "Beginner");
    const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0];
    if (!(await verifyCaptcha(req.body?.captchaToken, ip))) {
      return res.status(400).json({ error: "Please complete the verification challenge." });
    }
    if (!email.includes("@") || !validPassword(password) || displayName.length < 2) {
      return res.status(400).json({ error: "Use a valid name, email, and password." });
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL ?? "gianaibo.dev@gmail.com").toLowerCase();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        role: email === adminEmail ? "ADMIN" : "MEMBER",
        player: {
          create: {
            displayName,
            fullName: displayName,
            email,
            skillLevel,
            rating: 2,
            tags: ["Member"]
          }
        }
      },
      include: { player: true }
    });
    await createSession(user.id, res);
    await audit(user.id, "AUTH_REGISTER", "User", user.id);
    return res.status(201).json({ user: publicUser(user) });
  }

  if (req.method === "POST" && action === "login") {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const user = await prisma.user.findUnique({ where: { email }, include: { player: true } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "This account is not active. Please contact a club administrator." });
    }
    await createSession(user.id, res);
    await audit(user.id, "AUTH_LOGIN", "User", user.id);
    return res.status(200).json({ user: publicUser(user) });
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
      return res.status(400).json({ error: "Enter a new password." });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(nextPassword) } }),
      prisma.authSession.deleteMany({ where: { userId: user.id } })
    ]);
    await createSession(user.id, res);
    await audit(user.id, "AUTH_PASSWORD_CHANGED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  if (req.method === "POST" && action === "revoke-sessions") {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await clearSession(req, res);
    await audit(user.id, "AUTH_SESSIONS_REVOKED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown auth action" });
}
