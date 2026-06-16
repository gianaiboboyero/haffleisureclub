import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireAdmin, requireUser } from "./_auth.js";
import { audit } from "./_audit.js";
import { publishRealtime } from "./_realtime.js";

const messageInclude = {
  author: { include: { player: true } },
  replyTo: { include: { author: { include: { player: true } } } },
  reactions: true
} as const;

const serialize = (message: any) => ({
  id: message.id,
  body: message.deletedAt ? "" : message.body,
  deleted: Boolean(message.deletedAt),
  editedAt: message.editedAt,
  createdAt: message.createdAt,
  author: {
    id: message.author.id,
    displayName: message.author.player?.displayName ?? message.author.email.split("@")[0],
    avatarUrl: message.author.player?.avatarUrl ?? null,
    role: message.author.role
  },
  replyTo: message.replyTo
    ? {
        id: message.replyTo.id,
        body: message.replyTo.deletedAt ? "Message removed" : message.replyTo.body,
        displayName:
          message.replyTo.author.player?.displayName ?? message.replyTo.author.email.split("@")[0]
      }
    : null,
  reactions: Object.values(
    message.reactions.reduce((groups: Record<string, any>, reaction: any) => {
      groups[reaction.emoji] ??= { emoji: reaction.emoji, count: 0, userIds: [] };
      groups[reaction.emoji].count += 1;
      groups[reaction.emoji].userIds.push(reaction.userId);
      return groups;
    }, {})
  )
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;
  const action = String(req.query.action ?? "messages");

  if (req.method === "GET" && action === "messages") {
    res.setHeader("Cache-Control", "private, no-store");
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const limit = Math.min(50, Math.max(10, Number(req.query.limit ?? 30) || 30));
    const messages = await prisma.chatMessage.findMany({
      take: limit + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: messageInclude
    });
    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);
    return res.status(200).json({
      messages: page.reverse().map(serialize),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    });
  }

  if (req.method === "POST" && action === "send") {
    const body = String(req.body?.body ?? "").trim().slice(0, 2000);
    if (!body) return res.status(400).json({ error: "Message cannot be empty." });
    const recent = await prisma.chatMessage.count({
      where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 10_000) } }
    });
    if (recent >= 5) return res.status(429).json({ error: "Please slow down before sending again." });
    const message = await prisma.chatMessage.create({
      data: {
        authorId: user.id,
        body,
        replyToId: typeof req.body?.replyToId === "string" ? req.body.replyToId : null
      },
      include: messageInclude
    });
    await publishRealtime("haff:community:general", "message.created", {
      entityId: message.id,
      eventId: `message-created-${message.id}-${message.updatedAt.toISOString()}`
    });
    return res.status(201).json({ message: serialize(message) });
  }

  if (req.method === "PATCH" && action === "edit") {
    const id = String(req.body?.id ?? req.body?.messageId ?? "");
    const body = String(req.body?.body ?? "").trim().slice(0, 2000);
    const existing = await prisma.chatMessage.findUnique({ where: { id } });
    if (!existing || (existing.authorId !== user.id && user.role !== "ADMIN")) {
      return res.status(404).json({ error: "Message not found." });
    }
    if (!body) return res.status(400).json({ error: "Message cannot be empty." });
    const message = await prisma.chatMessage.update({
      where: { id },
      data: { body, editedAt: new Date() },
      include: messageInclude
    });
    await publishRealtime("haff:community:general", "message.updated", {
      entityId: message.id,
      eventId: `message-updated-${message.id}-${message.updatedAt.toISOString()}`
    });
    return res.status(200).json({ message: serialize(message) });
  }

  if (req.method === "DELETE" && action === "delete") {
    const id = String(req.query.id ?? req.body?.id ?? req.body?.messageId ?? "");
    const existing = await prisma.chatMessage.findUnique({ where: { id } });
    if (!existing || (existing.authorId !== user.id && user.role !== "ADMIN")) {
      return res.status(404).json({ error: "Message not found." });
    }
    const message = await prisma.chatMessage.update({
      where: { id },
      data: { deletedAt: new Date(), body: "" },
      include: messageInclude
    });
    await publishRealtime("haff:community:general", "message.deleted", {
      entityId: message.id,
      eventId: `message-deleted-${message.id}-${message.updatedAt.toISOString()}`
    });
    if (user.role === "ADMIN" && existing.authorId !== user.id) {
      await audit(user.id, "CHAT_MESSAGE_REMOVED", "ChatMessage", id);
    }
    return res.status(200).json({ message: serialize(message) });
  }

  if (req.method === "POST" && action === "react") {
    const messageId = String(req.body?.messageId ?? "");
    const emoji = String(req.body?.emoji ?? "").slice(0, 8);
    const key = { messageId_userId_emoji: { messageId, userId: user.id, emoji } };
    const existing = await prisma.chatReaction.findUnique({ where: key });
    if (!["👍", "❤️", "😂", "😮", "😢", "🎉"].includes(emoji)) {
      return res.status(400).json({ error: "Unsupported reaction." });
    }
    if (existing) await prisma.chatReaction.delete({ where: { id: existing.id } });
    else await prisma.chatReaction.create({ data: { messageId, userId: user.id, emoji } });
    const message = await prisma.chatMessage.findUnique({ where: { id: messageId }, include: messageInclude });
    await publishRealtime("haff:community:general", "reaction.changed", {
      entityId: messageId,
      eventId: `reaction-${messageId}-${user.id}-${emoji}-${Date.now()}`
    });
    return res.status(200).json({ active: !existing, message: message ? serialize(message) : null });
  }

  if (req.method === "POST" && action === "report") {
    await prisma.chatReport.upsert({
      where: {
        messageId_reporterId: {
          messageId: String(req.body?.messageId ?? ""),
          reporterId: user.id
        }
      },
      create: {
        messageId: String(req.body?.messageId ?? ""),
        reporterId: user.id,
        reason: String(req.body?.reason ?? "Inappropriate content").slice(0, 300)
      },
      update: { reason: String(req.body?.reason ?? "Inappropriate content").slice(0, 300) }
    });
    return res.status(200).json({ success: true });
  }

  if (req.method === "GET" && action === "reports") {
    if (!(await requireAdmin(req, res))) return;
    const reports = await prisma.chatReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        message: { include: { author: { include: { player: true } } } },
        reporter: { include: { player: true } }
      }
    });
    return res.status(200).json({ reports });
  }

  return res.status(404).json({ error: "Unknown community action" });
}
