import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const courts = await prisma.court.findMany({
      orderBy: { number: "asc" }
    });
    return res.status(200).json({ status: "success", count: courts.length, courts });
  } catch (error) {
    console.error("Failed to fetch courts", error);
    return res.status(500).json({ status: "error", message: "Failed to fetch courts" });
  }
}
