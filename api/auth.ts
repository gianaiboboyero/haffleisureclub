import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";
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
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("AdminConfig").select("value").eq("key", "write_token").maybeSingle();
  return data?.value ?? null;
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
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: existingUser } = await supabase.from("User").select().eq("email", email).single();
    if (existingUser) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL ? process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase() : null;
    const { data: newPlayer, error: playerError } = await supabase.from("Player").insert({
      displayName,
      fullName: displayName,
      email,
      skillLevel,
      rating: 2,
      tags: ["Member"],
      updatedAt: new Date().toISOString()
    }).select().single();

    if (playerError) {
      console.error("Player insert error:", playerError);
      return res.status(500).json({ error: "Failed to create player record. Details: " + playerError.message });
    }

    const { data: user, error: userError } = await supabase.from("User").insert({
      email,
      passwordHash: hashPassword(password),
      role: (adminEmail && email === adminEmail) ? "ADMIN" : "MEMBER",
      playerId: newPlayer.id
    }).select().single();

    if (userError) {
      console.error("User insert error:", userError);
      return res.status(500).json({ error: "Failed to create user record. Details: " + userError.message });
    }
    user.player = newPlayer;
    await createSession(req, user.id, res);
    await audit(user.id, "AUTH_REGISTER", "User", user.id);
    return res.status(201).json({ user: publicUser(user) });
  }

  if (req.method === "POST" && action === "login") {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0];
    const bucket = loginFailureBucket(email, ip);
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { count: recentFailures } = await supabase.from("AuditLog").select("*", { count: "exact", head: true })
      .eq("action", "AUTH_LOGIN_FAILED")
      .eq("entityId", bucket)
      .gte("createdAt", new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS).toISOString());
    if (recentFailures !== null && recentFailures >= MAX_LOGIN_FAILURES) {
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }
    const { data: user } = await supabase.from("User").select("*, player:Player(*)").eq("email", email).single();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await audit(null, "AUTH_LOGIN_FAILED", "LoginAttempt", bucket);
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "This account is not active. Please contact a club administrator." });
    }
    await createSession(req, user.id, res);
    await audit(user.id, "AUTH_LOGIN", "User", user.id);
    const userJson = publicUser(user);
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
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from("User").update({ passwordHash: hashPassword(nextPassword) }).eq("id", user.id);
      await supabase.from("AuthSession").delete().eq("userId", user.id);
    }
    await createSession(req, user.id, res);
    await audit(user.id, "AUTH_PASSWORD_CHANGED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  if (req.method === "POST" && action === "revoke-sessions") {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from("AuthSession").delete().eq("userId", user.id);
    }
    await clearSession(req, res);
    await audit(user.id, "AUTH_SESSIONS_REVOKED", "User", user.id);
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown auth action" });
}
