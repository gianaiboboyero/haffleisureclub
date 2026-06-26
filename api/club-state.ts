import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";
import { getUser } from "./_auth.js";
import { getSupabaseAdmin } from "./_supabaseAdmin.js";

type SessionRow = {
  id: string;
  checkedInPlayerIds: string[];
  settings: unknown;
  updatedAt: Date | string | null;
  status?: string;
};

const fallbackCourts = [
  { id: "court-1", name: "Court 1", number: 1, status: "Available", priority: 1, reservable: true },
  { id: "court-2", name: "Court 2", number: 2, status: "Available", priority: 2, reservable: true },
  { id: "court-3", name: "Court 3", number: 3, status: "Available", priority: 3, reservable: true }
];

const stringArray = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

function updatedAtIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function unchangedSince(sinceRaw: string | undefined, updatedAt: string | null) {
  if (!sinceRaw || !updatedAt) return false;
  const sinceMs = Date.parse(sinceRaw);
  const updatedMs = Date.parse(updatedAt);
  return sinceRaw === updatedAt || (!Number.isNaN(sinceMs) && sinceMs === updatedMs);
}

function activeMatchPlayerIds(matches: unknown) {
  const ids = new Set<string>();
  if (!Array.isArray(matches)) return ids;
  for (const entry of matches) {
    if (!entry || typeof entry !== "object") continue;
    const match = entry as Record<string, unknown>;
    if (match.status !== "InProgress") continue;
    for (const key of ["teamAPlayerIds", "teamBPlayerIds"]) {
      for (const id of stringArray(match[key])) {
        if (id && id !== "vacant" && !id.startsWith("vacant")) ids.add(id);
      }
    }
  }
  return ids;
}

function includeStackedPlayers(checkedInIds: string[], stackOrder: unknown) {
  const ids = new Set(checkedInIds);
  for (const id of stringArray(stackOrder)) {
    if (id !== "vacant" && id !== "reserved" && !id.startsWith("vacant")) ids.add(id);
  }
  return [...ids];
}

function normalizeStack(value: unknown, checkedInIds: string[]) {
  const eligible = new Set(checkedInIds);
  const seen = new Set<string>();
  return stringArray(value).map((id) => {
    if (id === "vacant" || id === "reserved") return id;
    if (!eligible.has(id) || seen.has(id)) return "vacant";
    seen.add(id);
    return id;
  });
}

function buildPayload(session: SessionRow, since?: string, lightView = false) {
  const settings = (session.settings && typeof session.settings === "object" ? session.settings : {}) as Record<string, unknown>;
  const updatedAt = updatedAtIso(session.updatedAt);

  if (unchangedSince(since, updatedAt)) {
    return {
      unchanged: true,
      sessionId: session.id,
      updatedAt,
      tvBroadcast: settings.tvBroadcast ?? null
    };
  }

  const allMatches = Array.isArray(settings.matches) ? settings.matches : [];
  const retainAfter = Date.now() - 30 * 60_000;
  const matches = allMatches.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const match = entry as Record<string, unknown>;
    if (match.status !== "Completed") return true;
    return typeof match.startedAt === "string" && Date.parse(match.startedAt) >= retainAfter;
  });
  const adminCheckedInIds = stringArray(settings.adminCheckedInIds);
  const rawCheckedIn = includeStackedPlayers(session.checkedInPlayerIds ?? [], settings.stackOrder);
  const checkedInPlayerIds = adminCheckedInIds.length === 0
    ? rawCheckedIn
    : rawCheckedIn.filter((id) => adminCheckedInIds.includes(id) || activeMatchPlayerIds(matches).has(id));
  const stackOrder = normalizeStack(settings.stackOrder, rawCheckedIn);

  return {
    sessionId: session.id,
    checkedInPlayerIds: includeStackedPlayers(checkedInPlayerIds, stackOrder),
    adminCheckedInIds,
    stackOrder,
    courts: Array.isArray(settings.courts) && settings.courts.length > 0 ? settings.courts : fallbackCourts,
    matches,
    reservations: lightView ? [] : Array.isArray(settings.reservations) ? settings.reservations : [],
    playerProfiles: lightView ? [] : Array.isArray(settings.playerProfiles) ? settings.playerProfiles : [],
    playerKudos: [],
    matchReviews: [],
    tvBroadcast: settings.tvBroadcast ?? null,
    updatedAt
  };
}

async function findActiveSession(sessionId?: string) {
  try {
    if (sessionId) {
      const { rows } = await dbQuery<SessionRow>(
        `SELECT id, "checkedInPlayerIds", settings, "updatedAt", status
         FROM "Session"
         WHERE id = $1
         LIMIT 1`,
        [sessionId]
      );
      if (rows[0]?.status === "Active") return rows[0];
    }

    const { rows } = await dbQuery<SessionRow>(
      `SELECT id, "checkedInPlayerIds", settings, "updatedAt", status
       FROM "Session"
       WHERE status = 'Active'
       ORDER BY "updatedAt" DESC
       LIMIT 1`
    );
    return rows[0] ?? null;
  } catch (error) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw error;
    if (sessionId) {
      const { data } = await supabase
        .from("Session")
        .select("id, checkedInPlayerIds, settings, updatedAt, status")
        .eq("id", sessionId)
        .limit(1)
        .maybeSingle();
      if (data?.status === "Active") return data as SessionRow;
    }
    const { data, error: readError } = await supabase
      .from("Session")
      .select("id, checkedInPlayerIds, settings, updatedAt, status")
      .eq("status", "Active")
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;
    return (data as SessionRow | null) ?? null;
  }
}

function emptyPayload(sessionId: string) {
  return {
    sessionId,
    checkedInPlayerIds: [],
    adminCheckedInIds: [],
    stackOrder: [],
    courts: fallbackCourts,
    matches: [],
    reservations: [],
    playerProfiles: [],
    playerKudos: [],
    matchReviews: [],
    tvBroadcast: null,
    updatedAt: null
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      const sessionId = String(req.query.sessionId ?? "default-active-session");
      const since = typeof req.query.since === "string" ? req.query.since : undefined;
      const lightView = req.query.view === "tv" || req.query.view === "player";
      const session = await findActiveSession(sessionId);

      if (!session) {
        if (req.query.ping) {
          return res.status(200).json({ ping: true, sessionId, updatedAt: null, unchanged: false });
        }
        return res.status(200).json(emptyPayload(sessionId));
      }

      const updatedAt = updatedAtIso(session.updatedAt);
      if (req.query.ping) {
        return res.status(200).json({
          ping: true,
          sessionId: session.id,
          updatedAt,
          unchanged: unchangedSince(since, updatedAt)
        });
      }

      return res.status(200).json(buildPayload(session, since, lightView));
    }

    if (req.method === "POST") {
      const user = await getUser(req);
      if (user?.role !== "ADMIN") return res.status(401).json({ error: "Authentication required" });

      const body = req.body ?? {};
      const sessionId = String(body.sessionId ?? "default-active-session");
      let rows: SessionRow[] = [];
      try {
        const result = await dbQuery<SessionRow>(
          `SELECT id, settings FROM "Session" WHERE id = $1 LIMIT 1`,
          [sessionId]
        );
        rows = result.rows;
      } catch {
        const supabase = getSupabaseAdmin();
        if (!supabase) throw new Error("Database not configured.");
        const { data } = await supabase.from("Session").select("id, settings").eq("id", sessionId).limit(1).maybeSingle();
        rows = data ? [data as SessionRow] : [];
      }
      const currentSettings = rows[0]?.settings && typeof rows[0].settings === "object" ? rows[0].settings : {};
      const settings = body.broadcastOnly
        ? { ...currentSettings, tvBroadcast: body.tvBroadcast ?? null }
        : {
            ...currentSettings,
            stackOrder: Array.isArray(body.stackOrder) ? body.stackOrder : [],
            adminCheckedInIds: Array.isArray(body.adminCheckedInIds) ? body.adminCheckedInIds : [],
            courts: Array.isArray(body.courts) ? body.courts : [],
            matches: Array.isArray(body.matches) ? body.matches : [],
            reservations: Array.isArray(body.reservations) ? body.reservations : [],
            playerProfiles: Array.isArray(body.playerProfiles) ? body.playerProfiles : []
          };

      const checkedInPlayerIds = Array.isArray(body.checkedInPlayerIds) ? body.checkedInPlayerIds.map(String) : [];
      const courtIds = Array.isArray(body.courts)
        ? body.courts.map((court: Record<string, unknown>) => String(court?.id ?? "")).filter(Boolean)
        : [];
      try {
        const { rows: updated } = await dbQuery<{ id: string; updatedAt: Date }>(
          `INSERT INTO "Session" (id, name, date, mode, status, "courtIds", "checkedInPlayerIds", settings, "updatedAt")
           VALUES ($1, 'Open Play Session', NOW(), 'Open Play', 'Active', $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE SET
             "checkedInPlayerIds" = EXCLUDED."checkedInPlayerIds",
             settings = EXCLUDED.settings,
             "updatedAt" = NOW()
           RETURNING id, "updatedAt"`,
          [sessionId, courtIds, checkedInPlayerIds, settings]
        );
        return res.status(200).json({ sessionId: updated[0].id, updatedAt: updatedAtIso(updated[0].updatedAt) });
      } catch (error) {
        const supabase = getSupabaseAdmin();
        if (!supabase) throw error;
        const { data, error: upsertError } = await supabase
          .from("Session")
          .upsert({
            id: sessionId,
            name: "Open Play Session",
            date: new Date().toISOString(),
            mode: "Open Play",
            status: "Active",
            courtIds,
            checkedInPlayerIds,
            settings,
            updatedAt: new Date().toISOString()
          }, { onConflict: "id" })
          .select("id, updatedAt")
          .maybeSingle();
        if (upsertError) throw upsertError;
        return res.status(200).json({ sessionId: data?.id ?? sessionId, updatedAt: data?.updatedAt ?? new Date().toISOString() });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("/api/club-state failed", error);
    const sessionId = String(req.query.sessionId ?? req.body?.sessionId ?? "default-active-session");
    return res.status(200).json(emptyPayload(sessionId));
  }
}
