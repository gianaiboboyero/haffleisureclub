import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import authHandler from "../api/auth.js";
import clubStateHandler from "../api/club-state.js";
import playersHandler from "../api/players.js";
import courtsHandler from "../api/courts.js";
import syncHandler from "../api/sync.js";
import communityHandler from "../api/community.js";
import feedbackHandler from "../api/feedback.js";
import { handleRecap as recapHandler, handleTestimonials as testimonialsHandler } from "../api/site-content.js";
import reservationsHandler from "../api/reservations.js";
import realtimeTokenHandler from "../api/realtime/token.js";
import operationsEventsHandler from "../api/operations/events.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "../dist/web");
const PORT = Number(process.env.PORT ?? 3000);
const API_ONLY = process.env.API_ONLY === "true";
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

function wrap(handler: ApiHandler) {
  return async (req: express.Request, res: express.Response) => {
    try {
      await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
    } catch (error) {
      console.error("[api]", req.method, req.url, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

const app = express();
app.set("trust proxy", 1);

if (FRONTEND_ORIGINS.length > 0) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && FRONTEND_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
}

app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

const routes: Array<{ mount: string; handler: ApiHandler }> = [
  { mount: "/api/auth", handler: authHandler },
  { mount: "/api/club-state", handler: clubStateHandler },
  { mount: "/api/players", handler: playersHandler },
  { mount: "/api/courts", handler: courtsHandler },
  { mount: "/api/sync", handler: syncHandler },
  { mount: "/api/community", handler: communityHandler },
  { mount: "/api/feedback", handler: feedbackHandler },
  { mount: "/api/testimonials", handler: testimonialsHandler },
  { mount: "/api/recap", handler: recapHandler },
  { mount: "/api/reservations", handler: reservationsHandler },
  { mount: "/api/realtime/token", handler: realtimeTokenHandler },
  { mount: "/api/operations/events", handler: operationsEventsHandler }
];

for (const { mount, handler } of routes) {
  app.all(`${mount}*`, wrap(handler));
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, apiOnly: API_ONLY });
});

if (!API_ONLY) {
  app.use(
    express.static(WEB_ROOT, {
      maxAge: "1y",
      immutable: true,
      index: false
    })
  );

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(WEB_ROOT, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `HAFF PicklePulse listening on http://0.0.0.0:${PORT}` +
      (API_ONLY ? " (API only — frontend on Vercel)" : "")
  );
});
