import { Rest } from "ably";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: "Realtime is not configured." });

  const scope = String(req.query.scope ?? "community");
  const client = new Rest({ key: apiKey });

  if (scope === "tv") {
    const tvSecret = process.env.TV_DEVICE_SECRET?.trim();
    if (tvSecret) {
      const provided = String(req.headers["x-tv-device-secret"] ?? req.query.secret ?? "");
      if (provided !== tvSecret) {
        return res.status(401).json({ error: "TV device not authorized." });
      }
    }
    const tokenRequest = await client.auth.createTokenRequest({
      clientId: `tv-${crypto.randomUUID()}`,
      capability: JSON.stringify({
        "haff:operations:club": ["subscribe"],
        "haff:operations:tv": ["subscribe"]
      })
    });
    return res.status(200).json(tokenRequest);
  }

  const user = await requireUser(req, res);
  if (!user) return;
  const capability: Record<string, string[]> = {
    "haff:community:general": ["subscribe"]
  };
  if (user.role === "ADMIN") {
    capability["haff:operations:club"] = ["subscribe"];
    capability["haff:operations:tv"] = ["subscribe"];
  }
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: user.id,
    capability: JSON.stringify(capability)
  });
  return res.status(200).json(tokenRequest);
}
