import type { Prisma } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireUser } from "./_auth.js";

type ClubSettings = {
  stackOrder?: string[];
  parkedPlayerIds?: string[];
  courts?: unknown[];
  matches?: unknown[];
};

const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : [];
const normalizeStack = (value: unknown, checkedInIds: string[], parkedIds: string[] = []) => {
  const eligible = new Set(checkedInIds.filter((id) => !parkedIds.includes(id)));
  const seen = new Set<string>();
  return stringArray(value).map((id) => {
    if (id === "vacant") return id;
    if (!eligible.has(id) || seen.has(id)) return "vacant";
    seen.add(id);
    return id;
  });
};

async function findSession(sessionId?: string) {
  if (sessionId) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (session) return session;
  }
  return prisma.session.findFirst({
    where: { status: "Active" },
    orderBy: { updatedAt: "desc" }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = await requireUser(req, res);
  if (!actor) return;

  const requestedSessionId = String(
    req.method === "GET" ? req.query.sessionId ?? "" : req.body?.sessionId ?? ""
  );
  let session = await findSession(requestedSessionId);

  if (req.method === "GET") {
    const settings = (session?.settings ?? {}) as ClubSettings;
    return res.status(200).json({
      sessionId: session?.id ?? (requestedSessionId || "default-active-session"),
      checkedInPlayerIds: session?.checkedInPlayerIds ?? [],
      parkedPlayerIds: stringArray(settings.parkedPlayerIds),
      stackOrder: stringArray(settings.stackOrder),
      courts: Array.isArray(settings.courts) ? settings.courts : [],
      matches: Array.isArray(settings.matches) ? settings.matches : [],
      updatedAt: session?.updatedAt ?? null
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const incomingCheckedIn = stringArray(req.body?.checkedInPlayerIds);
  const incomingParked = stringArray(req.body?.parkedPlayerIds);
  const incomingStack = stringArray(req.body?.stackOrder);

  if (!session) {
    session = await prisma.session.create({
      data: {
        id: requestedSessionId || "default-active-session",
        name: "Open Play Session",
        date: new Date(),
        mode: "Open Play",
        status: "Active",
        checkedInPlayerIds: [],
        settings: {}
      }
    });
  }

  const currentSettings = (session.settings ?? {}) as ClubSettings;
  let checkedInPlayerIds = session.checkedInPlayerIds;
  let parkedPlayerIds = stringArray(currentSettings.parkedPlayerIds);
  let stackOrder = stringArray(currentSettings.stackOrder);
  let courts = Array.isArray(currentSettings.courts) ? currentSettings.courts : [];
  let matches = Array.isArray(currentSettings.matches) ? currentSettings.matches : [];

  if (actor.role === "ADMIN") {
    checkedInPlayerIds = incomingCheckedIn;
    parkedPlayerIds = incomingParked.filter((id) => incomingCheckedIn.includes(id));
    stackOrder = normalizeStack(incomingStack, checkedInPlayerIds, parkedPlayerIds);
    courts = Array.isArray(req.body?.courts) ? req.body.courts : courts;
    matches = Array.isArray(req.body?.matches) ? req.body.matches : matches;
  } else if (actor.playerId) {
    const playerId = actor.playerId;
    const wantsCheckedIn = incomingCheckedIn.includes(playerId);
    const wantsParked = incomingParked.includes(playerId);
    const wasCheckedIn = checkedInPlayerIds.includes(playerId);
    const wasParked = parkedPlayerIds.includes(playerId);
    checkedInPlayerIds = wantsCheckedIn
      ? Array.from(new Set([...checkedInPlayerIds, playerId]))
      : checkedInPlayerIds.filter((id) => id !== playerId);
    parkedPlayerIds = wantsParked && wantsCheckedIn
      ? Array.from(new Set([...parkedPlayerIds, playerId]))
      : parkedPlayerIds.filter((id) => id !== playerId);
    if (wantsCheckedIn !== wasCheckedIn || wantsParked !== wasParked) {
      stackOrder = stackOrder.filter((id) => id !== playerId);
      if (wantsCheckedIn && !wantsParked) {
        const vacantIndex = stackOrder.indexOf("vacant");
        if (vacantIndex >= 0) stackOrder[vacantIndex] = playerId;
        else stackOrder.push(playerId);
      }
    }
    stackOrder = normalizeStack(stackOrder, checkedInPlayerIds, parkedPlayerIds);
  }

  const settings: Prisma.InputJsonValue = {
    ...(session.settings as Record<string, unknown>),
    parkedPlayerIds,
    stackOrder,
    courts,
    matches
  } as Prisma.InputJsonValue;

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { checkedInPlayerIds, settings }
  });

  return res.status(200).json({
    sessionId: updated.id,
    checkedInPlayerIds,
    parkedPlayerIds,
    stackOrder,
    courts,
    matches,
    updatedAt: updated.updatedAt
  });
}
