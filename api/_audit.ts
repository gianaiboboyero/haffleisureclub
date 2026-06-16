import type { Prisma } from "@prisma/client";
import { prisma } from "./_prisma.js";

export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata
    }
  });
}
