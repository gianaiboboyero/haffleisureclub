import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";
import { getUser } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const { rows } = await dbQuery<{ key: string; value: string }>(
      `SELECT key, value FROM "AdminConfig"`
    );
    const config: Record<string, string> = {};
    for (const row of rows) {
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
      await dbQuery(
        `INSERT INTO "AdminConfig" (key, value, "updatedAt") VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
        [key, value]
      );
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
