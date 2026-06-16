import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireAdmin, requireUser } from "./_auth.js";
import { audit } from "./_audit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "approved");

  if (req.method === "GET" && action === "approved") {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    const testimonials = await prisma.testimonial.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ featured: "desc" }, { approvedAt: "desc" }],
      take: 12,
      include: { player: true }
    });
    return res.status(200).json({
      testimonials: testimonials.map((item) => ({
        id: item.id,
        quote: item.quote,
        rating: item.rating,
        displayName: item.player?.displayName ?? "HAFF member",
        skillLevel: item.player?.skillLevel ?? null
      }))
    });
  }

  if (req.method === "POST" && action === "submit") {
    const user = await requireUser(req, res);
    if (!user) return;
    const quote = String(req.body?.quote ?? "").trim().slice(0, 500);
    const rating = Number(req.body?.rating ?? 0);
    if (quote.length < 20) return res.status(400).json({ error: "Please write at least 20 characters." });
    const testimonial = await prisma.testimonial.create({
      data: {
        userId: user.id,
        playerId: user.playerId,
        quote,
        rating: rating >= 1 && rating <= 5 ? rating : null
      }
    });
    return res.status(201).json({ testimonial });
  }

  if (req.method === "GET" && action === "pending") {
    if (!(await requireAdmin(req, res))) return;
    const testimonials = await prisma.testimonial.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { player: true, user: true }
    });
    return res.status(200).json({ testimonials });
  }

  if (req.method === "POST" && action === "moderate") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const status = req.body?.status === "APPROVED" ? "APPROVED" : "REJECTED";
    await prisma.testimonial.update({
      where: { id: String(req.body?.id ?? "") },
      data: {
        status,
        featured: status === "APPROVED" && Boolean(req.body?.featured),
        approvedById: admin.id,
        approvedAt: status === "APPROVED" ? new Date() : null
      }
    });
    await audit(admin.id, "TESTIMONIAL_MODERATED", "Testimonial", String(req.body?.id ?? ""), { status });
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Unknown testimonial action" });
}
