import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const BASE = "https://haffleisureclub.vercel.app";

async function verify() {
  console.log("1. Testing Vercel URL...");
  const res = await fetch(BASE);
  console.log(`Homepage status: ${res.status} ${res.statusText}`);
  
  console.log("2. Testing API endpoint...");
  const apiRes = await fetch(`${BASE}/api/auth?action=me`);
  const apiData = await apiRes.json();
  console.log(`API Status: ${apiRes.status}, data:`, apiData);

  console.log("3. Testing database query...");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const dbRes = await client.query('SELECT COUNT(*)::integer as count FROM "Player"');
  console.log(`Total players in new DB: ${dbRes.rows[0].count}`);
  await client.end();
  
  console.log("Verification finished successfully!");
}

verify().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
