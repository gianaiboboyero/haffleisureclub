/** Pure security helpers (testable without Vercel/Prisma). */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_LOGIN_FAILURES = 8;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;

type Env = Record<string, string | undefined>;

export function isProductionEnv(env: Env = process.env) {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

export function validPassword(password: unknown) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

export function passwordValidationMessage() {
  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
}

export function feedbackHashSecret(env: Env = process.env) {
  const secret = env.FEEDBACK_HASH_SECRET?.trim();
  if (secret) return secret;
  if (isProductionEnv(env)) {
    throw new Error("FEEDBACK_HASH_SECRET is required in production.");
  }
  return "haff-cadiz-dev-only";
}

export function captchaRequired(env: Env = process.env) {
  return isProductionEnv(env) && Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

/** Columns safe for anon/browser roster reads — excludes phone, email, statusNote, internal stats. */
export const PUBLIC_PLAYER_COLUMNS = [
  "id",
  "displayName",
  "fullName",
  "nickname",
  "skillLevel",
  "rating",
  "avatarUrl",
  "avatarVersion",
  "tags",
  "status",
  "totalGamesPlayed",
  "totalDaysPlayed",
  "lastPlayedDate",
  "version",
  "updatedAt"
] as const;

export function publicPlayerSelectSql() {
  return PUBLIC_PLAYER_COLUMNS.join(", ");
}

/** Public roster fields for TV/player display — no phone, email, or internal notes. */
export function publicPlayerDto(player: Record<string, unknown>) {
  return {
    id: player.id,
    displayName: player.displayName,
    fullName: player.fullName ?? null,
    nickname: player.nickname ?? null,
    skillLevel: player.skillLevel,
    rating: player.rating,
    avatarUrl: player.avatarUrl ?? null,
    avatarVersion: player.avatarVersion ?? 0,
    tags: player.tags ?? [],
    status: player.status,
    totalGamesPlayed: player.totalGamesPlayed ?? 0,
    totalDaysPlayed: player.totalDaysPlayed ?? 0,
    lastPlayedDate: player.lastPlayedDate ?? null,
    version: player.version ?? 0,
    updatedAt: player.updatedAt
  };
}

/** Calendar week view — hide requester email unless viewer is admin or the host. */
export function publicReservationDto(
  reservation: Record<string, any>,
  viewer: { id?: string; role?: string } | null | undefined
) {
  const canSeePrivate =
    viewer?.role === "ADMIN" || viewer?.id === reservation.requesterUserId;
  const requesterName =
    reservation.requester?.player?.displayName
    || reservation.requester?.email?.split("@")[0]
    || "Player";

  if (canSeePrivate) return reservation;

  return {
    id: reservation.id,
    courtId: reservation.courtId,
    startTime: reservation.startTime,
    endTime: reservation.endTime,
    approvalStatus: reservation.approvalStatus,
    createdAt: reservation.createdAt,
    publicLabel:
      reservation.publicLabel
      || (reservation.approvalStatus === "CONFIRMED"
        ? `Reserved (${requesterName})`
        : `Requested (${requesterName})`),
    requester: {
      player: { displayName: requesterName }
    }
  };
}

/** Restrict profile avatar URLs to this project's Supabase storage bucket. */
export function isAllowedAvatarUrl(url: unknown, supabaseProjectUrl: unknown) {
  if (!url || typeof url !== "string") return true;
  const base = String(supabaseProjectUrl ?? "").replace(/\/$/, "");
  if (!base) return false;
  const prefix = `${base}/storage/v1/object/public/avatars/`;
  return url.startsWith(prefix);
}

export function loginFailureBucket(email: unknown, ip: unknown) {
  const normalized = String(email ?? "").trim().toLowerCase();
  const source = String(ip ?? "unknown").split(",")[0].trim();
  return `${normalized}:${source}`;
}
