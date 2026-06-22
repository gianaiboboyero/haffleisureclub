import { getSupabaseAdmin } from "./_supabaseAdmin.js";

export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: any
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("AuditLog").insert({
    userId,
    action,
    entityType,
    entityId: entityId ?? null,
    metadata
  });
}
