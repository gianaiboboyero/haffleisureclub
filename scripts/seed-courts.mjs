#!/usr/bin/env node
/** Seed default courts in Supabase if table is empty. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const count = await prisma.court.count();
if (count > 0) {
  console.log(`Courts already exist (${count}) — skipping seed`);
  await prisma.$disconnect();
  process.exit(0);
}

const seed = [1, 2, 3].map((number) => ({
  id: `court-${number}`,
  name: `Court ${number}`,
  number,
  status: "Available"
}));

await prisma.court.createMany({ data: seed });
console.log(`Seeded ${seed.length} courts`);
await prisma.$disconnect();
