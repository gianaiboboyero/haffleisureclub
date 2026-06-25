#!/usr/bin/env node
/**
 * Restore a functional HAFF export into the database pointed to by DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/restore-functional-export.mjs data/private/old-production-functional-export-latest.json
 *
 * The export includes sensitive app auth rows. Keep files under data/private/
 * and never commit them.
 */
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "data/private/old-production-functional-export-latest.json";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const models = payload.models ?? {};
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const pgClient = new pg.Client({ connectionString: databaseUrl });

const jsonFields = new Map([
  ["session", ["settings"]],
  ["syncEvent", ["payload"]],
  ["operationEvent", ["payload", "result"]],
  ["auditLog", ["metadata"]],
]);

function cleanRow(model, row) {
  const out = { ...row };
  for (const key of jsonFields.get(model) ?? []) {
    if (out[key] === null || out[key] === undefined) continue;
    if (typeof out[key] === "string") {
      try {
        out[key] = JSON.parse(out[key]);
      } catch {
        // Leave as-is; Prisma can store JSON strings as scalar JSON values.
      }
    }
  }
  return out;
}

async function upsertMany(model, idField = "id") {
  const rows = Array.isArray(models[model]) ? models[model] : [];
  let count = 0;
  for (const row of rows) {
    if (!row?.[idField]) continue;
    const data = cleanRow(model, row);
    await prisma[model].upsert({
      where: { [idField]: data[idField] },
      create: data,
      update: data,
    });
    count += 1;
  }
  console.log(`${model}: ${count}`);
}

async function restoreAdminConfig() {
  const rows = Array.isArray(models.adminConfig) ? models.adminConfig : [];
  await pgClient.query(`
    create table if not exists "AdminConfig" (
      "key" text primary key,
      "value" text not null,
      "updatedAt" timestamptz not null default now()
    )
  `);

  let count = 0;
  for (const row of rows) {
    if (!row?.key || typeof row.value !== "string") continue;
    await pgClient.query(
      `insert into "AdminConfig" ("key", "value", "updatedAt")
       values ($1, $2, coalesce($3::timestamptz, now()))
       on conflict ("key") do update set "value" = excluded."value", "updatedAt" = excluded."updatedAt"`,
      [row.key, row.value, row.updatedAt ?? null]
    );
    count += 1;
  }
  console.log(`adminConfig: ${count}`);
}

async function main() {
  await pgClient.connect();
  await restoreAdminConfig();

  await upsertMany("player");
  await upsertMany("court");
  await upsertMany("user");
  // await upsertMany("authSession");
  // await upsertMany("session");
  await upsertMany("match");
  // await upsertMany("syncEvent");
  // await upsertMany("notification");
  await upsertMany("courtReservationSetting");
  await upsertMany("courtAllocation");
  await upsertMany("courtBlackout");
  // await upsertMany("chatMessage");
  // await upsertMany("chatReaction");
  // await upsertMany("chatReport");
  await upsertMany("testimonial");
  // await upsertMany("improvementReport");
  // await upsertMany("auditLog");
  // await upsertMany("operationEvent", "idempotencyKey");
  await upsertMany("courtReservation");
  // await upsertMany("userNotification");

  await pgClient.end();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await pgClient.end().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
