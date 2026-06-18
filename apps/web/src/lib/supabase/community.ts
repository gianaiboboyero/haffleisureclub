import { getSupabase } from "./client";

export type CommunityMessage = {
  id: string;
  body: string;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  };
  replyTo: { id: string; body: string; displayName: string } | null;
  reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
};

type ChatRow = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  authorId: string;
};

type UserRow = {
  id: string;
  email: string;
  role: string;
  playerId: string | null;
};

type PlayerMini = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function fetchCommunityMessages(options?: {
  limit?: number;
  before?: string;
  since?: string;
}): Promise<{
  messages: CommunityMessage[];
  nextCursor: string | null;
  unchanged?: boolean;
  latestAt?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) return { messages: [], nextCursor: null };

  const limit = Math.min(50, Math.max(10, options?.limit ?? 30));

  if (options?.since && !options.before) {
    const { data: latest } = await supabase
      .from("ChatMessage")
      .select("id, createdAt")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.createdAt) {
      const serverIso = String(latest.createdAt);
      const sinceMs = Date.parse(options.since);
      const serverMs = Date.parse(serverIso);
      if (options.since === serverIso || (!Number.isNaN(sinceMs) && sinceMs === serverMs)) {
        return { messages: [], nextCursor: null, unchanged: true, latestAt: serverIso };
      }
    }
  }

  let query = supabase
    .from("ChatMessage")
    .select("id, body, createdAt, editedAt, deletedAt, replyToId, authorId")
    .order("createdAt", { ascending: false })
    .limit(limit + 1);

  if (options?.before) {
    const { data: cursor } = await supabase
      .from("ChatMessage")
      .select("createdAt")
      .eq("id", options.before)
      .maybeSingle();
    if (cursor?.createdAt) {
      query = query.lt("createdAt", cursor.createdAt);
    }
  }

  const { data: rows, error } = await query;
  if (error || !rows) return { messages: [], nextCursor: null };

  const chatRows = rows as ChatRow[];
  const hasMore = chatRows.length > limit;
  const page = chatRows.slice(0, limit);
  const authorIds = [...new Set(page.map((row) => row.authorId))];
  const replyIds = [...new Set(page.map((row) => row.replyToId).filter(Boolean))] as string[];

  const [{ data: users }, { data: replies }] = await Promise.all([
    supabase.from("User").select("id, email, role, playerId").in("id", authorIds),
    replyIds.length
      ? supabase.from("ChatMessage").select("id, body, deletedAt, authorId").in("id", replyIds)
      : Promise.resolve({ data: [] as Array<{ id: string; body: string; deletedAt: string | null; authorId: string }> })
  ]);

  const userRows = (users ?? []) as UserRow[];
  const playerIds = [...new Set(userRows.map((u) => u.playerId).filter(Boolean))] as string[];
  const replyAuthorIds = [...new Set((replies ?? []).map((r) => r.authorId))];
  const moreUserIds = replyAuthorIds.filter((id) => !authorIds.includes(id));

  const [{ data: players }, { data: replyUsers }] = await Promise.all([
    playerIds.length
      ? supabase.from("Player").select("id, displayName, avatarUrl").in("id", playerIds)
      : Promise.resolve({ data: [] as PlayerMini[] }),
    moreUserIds.length
      ? supabase.from("User").select("id, email, playerId").in("id", moreUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string; playerId: string | null }> })
  ]);

  const playerById = new Map((players ?? []).map((p) => [p.id, p as PlayerMini]));
  const userById = new Map(userRows.map((u) => [u.id, u]));
  for (const u of replyUsers ?? []) {
    userById.set(u.id, { id: u.id, email: u.email, role: "MEMBER", playerId: u.playerId });
  }

  const displayNameForUser = (userId: string) => {
    const user = userById.get(userId);
    if (!user) return "Member";
    if (user.playerId) {
      const player = playerById.get(user.playerId);
      if (player?.displayName) return player.displayName;
    }
    return user.email.split("@")[0];
  };

  const avatarForUser = (userId: string) => {
    const user = userById.get(userId);
    if (!user?.playerId) return null;
    return playerById.get(user.playerId)?.avatarUrl ?? null;
  };

  const replyById = new Map((replies ?? []).map((r) => [r.id, r]));

  const messages: CommunityMessage[] = page.reverse().map((row) => {
    const user = userById.get(row.authorId);
    const reply = row.replyToId ? replyById.get(row.replyToId) : null;
    return {
      id: row.id,
      body: row.deletedAt ? "" : row.body,
      deleted: Boolean(row.deletedAt),
      editedAt: row.editedAt,
      createdAt: row.createdAt,
      author: {
        id: row.authorId,
        displayName: displayNameForUser(row.authorId),
        avatarUrl: avatarForUser(row.authorId),
        role: user?.role ?? "MEMBER"
      },
      replyTo: reply
        ? {
            id: reply.id,
            body: reply.deletedAt ? "Message removed" : reply.body,
            displayName: displayNameForUser(reply.authorId)
          }
        : null,
      reactions: []
    };
  });

  return {
    messages,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null
  };
}
