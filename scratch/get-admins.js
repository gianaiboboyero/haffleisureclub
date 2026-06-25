import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel.prod' });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query('SELECT email, role, status FROM "User" WHERE role = \'ADMIN\'');
  console.log('Admins:', res.rows);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
