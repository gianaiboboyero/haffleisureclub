import type { VercelRequest } from "@vercel/node";

const limiters = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1";
}

/**
 * Basic in-memory rate limiter for Vercel Serverless Functions.
 * Returns true if request is within limits, false otherwise.
 */
export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = limiters.get(ip);

  if (!record || now > record.resetAt) {
    limiters.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
