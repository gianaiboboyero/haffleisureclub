import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";

for (const file of [".env.local", ".env.production", ".env"]) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

function mb(bytes) {
  return Number((Number(bytes) / 1024 / 1024).toFixed(2));
}

await client.connect();

try {
  const before = await client.query(`
    select
      count(*)::int as count,
      pg_total_relation_size('public."OperationEvent"') as bytes
    from public."OperationEvent"
  `);

  await client.query(`
    delete from public."OperationEvent"
    where "createdAt" < now() - interval '7 days'
       or status in ('APPLIED', 'CONFLICT', 'FAILED')
  `);

  const after = await client.query(`
    select
      count(*)::int as count,
      pg_total_relation_size('public."OperationEvent"') as bytes
    from public."OperationEvent"
  `);

  const database = await client.query("select pg_database_size(current_database()) as bytes");

  console.log(JSON.stringify({
    operationEvent: {
      before: {
        count: before.rows[0].count,
        mb: mb(before.rows[0].bytes)
      },
      after: {
        count: after.rows[0].count,
        mb: mb(after.rows[0].bytes)
      }
    },
    databaseMb: mb(database.rows[0].bytes)
  }, null, 2));
} finally {
  await client.end();
}
