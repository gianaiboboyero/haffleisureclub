import { randomUUID } from "node:crypto";
import { dbQuery } from "./_db.js";

export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: any
) {
  try {
    await dbQuery(
      `INSERT INTO "AuditLog" (id, "userId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [randomUUID(), userId ?? null, action, entityType, entityId ?? null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch {
    // Audit log failures should never break the main flow
  }
}
