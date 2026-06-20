#!/usr/bin/env node
/**
 * Seed HAFF admin + member accounts (upsert by email).
 * Usage: node scripts/seed-accounts.mjs
 */
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_ACCOUNT_PASSWORD?.trim();
if (!PASSWORD || PASSWORD.length < 12) {
  console.error("Set SEED_ACCOUNT_PASSWORD (min 12 chars) before seeding accounts.");
  console.error("Example: SEED_ACCOUNT_PASSWORD='...' node scripts/seed-accounts.mjs");
  process.exit(1);
}

const ADMINS = [
  { email: "kayenegoza@gmail.com", displayName: "yiekay" },
  { email: "justkatieangel@gmail.com", displayName: "kat" },
  { email: "haffleisureclub@gmail.com", displayName: "haffleisureclub" }
];

const MEMBERS = [
  { email: "fkbnegosa@gmail.com", displayName: "Fkbnegosa" },
  { email: "aiboboyero@gmail.com", displayName: "Gian Aibo" },
  { email: "gib.designer.work@gmail.com", displayName: "Gib Designer" }
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function displayName(email) {
  const local = email.split("@")[0] ?? "Player";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertAccount(email, role, displayNameOverride) {
  const normalized = email.trim().toLowerCase();
  const name = displayNameOverride ?? displayName(normalized);
  const passwordHash = hashPassword(PASSWORD);

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    include: { player: true }
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role, passwordHash, status: "ACTIVE" }
    });
    if (existing.player) {
      await prisma.player.update({
        where: { id: existing.player.id },
        data: { displayName: name, fullName: name, email: normalized, status: "Active" }
      });
    } else {
      const player = await prisma.player.create({
        data: {
          displayName: name,
          fullName: name,
          email: normalized,
          skillLevel: "Beginner",
          rating: 2,
          tags: role === "ADMIN" ? ["Member", "Admin"] : ["Member"],
          status: "Active"
        }
      });
      await prisma.user.update({
        where: { id: existing.id },
        data: { playerId: player.id }
      });
    }
    return { email: normalized, role, action: "updated" };
  }

  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      role,
      status: "ACTIVE",
      player: {
        create: {
          displayName: name,
          fullName: name,
          email: normalized,
          skillLevel: "Beginner",
          rating: 2,
          tags: role === "ADMIN" ? ["Member", "Admin"] : ["Member"],
          status: "Active"
        }
      }
    },
    include: { player: true }
  });

  return { email: user.email, role: user.role, action: "created", playerId: user.playerId };
}

async function stripKudosFromSession() {
  const session = await prisma.session.findUnique({ where: { id: "default-active-session" } });
  if (!session) return;
  const settings = (session.settings ?? {}) ;
  const { playerKudos: _k, matchReviews: _r, ...rest } = settings;
  await prisma.session.update({
    where: { id: session.id },
    data: { settings: rest }
  });
}

const results = [];
for (const admin of ADMINS) {
  results.push(await upsertAccount(admin.email, "ADMIN", admin.displayName));
}
for (const member of MEMBERS) {
  results.push(await upsertAccount(member.email, "MEMBER", member.displayName));
}
await stripKudosFromSession();

console.log("Seeded accounts:");
for (const row of results) {
  console.log(`  ${row.action.padEnd(7)} ${row.role.padEnd(6)} ${row.email}`);
}

await prisma.$disconnect();
