import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireAdmin } from "./_auth.js";
import { audit } from "./_audit.js";

const sourceHash = (req: VercelRequest) => {
  const source = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0];
  return createHash("sha256")
    .update(`${process.env.FEEDBACK_HASH_SECRET ?? "haff-cadiz"}:${source}:${new Date().toISOString().slice(0, 10)}`)
    .digest("hex");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "submit");

  if (req.method === "POST" && action === "submit") {
    const hash = sourceHash(req);
    const recent = await prisma.improvementReport.count({
      where: { sourceHash: hash, createdAt: { gte: new Date(Date.now() - 3600_000) } }
    });
    if (recent >= 3) return res.status(429).json({ error: "Please wait before sending another report." });
    const category = String(req.body?.category ?? "Other").slice(0, 40);
    const message = String(req.body?.message ?? "").trim().slice(0, 2000);
    const contact = String(req.body?.contact ?? "").trim().slice(0, 160) || null;
    if (message.length < 20) return res.status(400).json({ error: "Please provide at least 20 characters." });
    await prisma.improvementReport.create({
      data: { category, message, contact, sourceHash: hash }
    });
    return res.status(201).json({ success: true });
  }

  if (req.method === "GET" && action === "list") {
    if (!(await requireAdmin(req, res))) return;
    const reports = await prisma.improvementReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return res.status(200).json({ reports });
  }

  if (req.method === "PATCH" && action === "read") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    await prisma.improvementReport.update({
      where: { id: String(req.body?.id ?? "") },
      data: { status: req.body?.status === "NEW" ? "NEW" : "READ" }
    });
    await audit(admin.id, "IMPROVEMENT_REPORT_UPDATED", "ImprovementReport", String(req.body?.id ?? ""), {
      status: req.body?.status === "NEW" ? "NEW" : "READ"
    });
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown feedback action" });
}
