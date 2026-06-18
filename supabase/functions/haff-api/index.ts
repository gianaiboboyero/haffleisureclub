// HAFF API — Supabase Edge Function entrypoint
// Deploy: supabase functions deploy haff-api --no-verify-jwt
//
// Full route parity with /api/* is ported incrementally. Until complete, run
// `npm start` locally against Supabase DATABASE_URL for development, or deploy
// this function and extend handlers below.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = (origin: string | null) => {
  const allowed = (Deno.env.get("FRONTEND_ORIGIN") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin =
    origin && allowed.some((entry) => entry === origin) ? origin : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, content-type, cookie",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  };
};

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/haff-api/, "") || "/";

  if (path === "/health" || path === "/api/health") {
    return Response.json({ ok: true, backend: "supabase-edge", apiOnly: true }, { headers });
  }

  // TODO: wire remaining /api/* handlers (club-state, auth, community, …)
  // Options:
  // 1. Port handlers to Deno-compatible fetch + postgres.js (no Prisma in Edge)
  // 2. Use Supabase client + RLS for reads; Edge Functions for admin writes
  // 3. Proxy to a long-running Node service (not Supabase-only)

  return Response.json(
    {
      error: "Not implemented on Edge Function yet",
      path,
      hint: "Use local `npm start` with Supabase DATABASE_URL for dev, or finish porting this route."
    },
    { status: 501, headers }
  );
});
