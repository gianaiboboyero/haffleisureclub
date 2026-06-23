import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";
import { clearSession, requireUser } from "./_auth.js";
import { audit } from "./_audit.js";
import { getClientIp, rateLimit } from "./_rateLimit.js";

/**
 * POST /api/delete-account
 *
 * Authenticated endpoint — user must be logged in.
 * Deletes all sessions, the User record, and marks the Player inactive.
 * Satisfies GDPR / right-to-erasure requirements.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate-limit: max 3 attempts per IP per 15 minutes
  const ip = getClientIp(req);
  if (!rateLimit(ip, 3, 15 * 60_000)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent 401

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Database not configured" });

  try {
    // 1. Log the deletion before we delete (keeps an audit trail)
    await audit(user.id, "ACCOUNT_DELETE_REQUESTED", "User", user.id, {
      email: user.email,
      role: user.role,
      playerId: user.playerId ?? null
    });

    // 2. Revoke all active sessions first
    await supabase.from("AuthSession").delete().eq("userId", user.id);

    // 3. Soft-delete the player profile (mark Inactive, erase PII)
    //    Hard deletion would break match/game history FK references.
    if (user.playerId) {
      await supabase
        .from("Player")
        .update({ status: "Inactive", email: null, phone: null })
        .eq("id", user.playerId);
    }

    // 4. Hard-delete the user account (login credentials)
    await supabase.from("User").delete().eq("id", user.id);

    // 5. Clear the session cookie
    await clearSession(req, res);

    return res.status(200).json({
      success: true,
      message:
        "Your account has been deleted. Your game history is anonymised and retained for club records."
    });
  } catch (err) {
    console.error("[delete-account] Error:", err instanceof Error ? err.message : err);
    return res.status(500).json({
      error: "Failed to delete account. Please contact a club administrator."
    });
  }
}
