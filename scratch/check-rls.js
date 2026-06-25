import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel.prod' });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT pol.polname, pol.polcmd, pol.polqual
    FROM pg_policy pol
    JOIN pg_class cl ON pol.polrelid = cl.oid
    JOIN pg_namespace nsp ON cl.relnamespace = nsp.oid
    WHERE nsp.nspname = 'public' AND cl.relname = 'Player';
  `);
  console.log('Player Policies:', res.rows);
  await client.end();
}

main().catch(console.error);
