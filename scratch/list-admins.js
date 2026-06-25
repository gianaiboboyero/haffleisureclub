import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query('SELECT id, email, role, status FROM "User"');
  console.log('Users:', res.rows);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
