#!/usr/bin/env node
/**
 * Set strong passwords for seeded admin/member accounts and revoke all sessions.
 *
 * Usage:
 *   ADMIN_PASSWORD='your-strong-password' node scripts/rotate-admin-passwords.mjs
 *   node scripts/rotate-admin-passwords.mjs   # generates a random password
 */
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

function generatePassword() {
  return randomBytes(18).toString("base64url");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const password = process.env.ADMIN_PASSWORD?.trim() || generatePassword();
const passwordHash = hashPassword(password);

const emails = [...ADMINS, ...MEMBERS].map((row) => row.email.trim().toLowerCase());
const updated = await prisma.user.updateMany({
  where: { email: { in: emails } },
  data: { passwordHash, status: "ACTIVE" }
});
const cleared = await prisma.authSession.deleteMany({});

console.log(`Updated ${updated.count} account password(s). Cleared ${cleared.count} session(s).`);
console.log("");
console.log("Admin accounts (change this password after first login):");
for (const admin of ADMINS) {
  console.log(`  ${admin.email}`);
}
console.log("");
console.log(`Password: ${password}`);
console.log("");
console.log("Store this password in a password manager. Do not commit it to git.");

await prisma.$disconnect();
