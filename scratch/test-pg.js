import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected successfully!');
  const res = await client.query('SELECT NOW()');
  console.log('Query result:', res.rows[0]);
  await client.end();
}

main().catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
