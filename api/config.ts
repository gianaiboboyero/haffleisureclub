import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";
import { getUser } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const { data } = await supabase.from("AdminConfig").select("key, value");
    const config: Record<string, string> = {};
    for (const row of data || []) {
      config[row.key] = row.value;
    }
    return res.status(200).json(config);
  }

  if (req.method === "POST") {
    const user = await getUser(req);
    if (user?.role !== "ADMIN") return res.status(403).json({ error: "Unauthorized" });
    
    const body = req.body || {};
    for (const key of Object.keys(body)) {
      const value = String(body[key]);
      await supabase.from("AdminConfig").upsert({ key, value }, { onConflict: "key" });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
