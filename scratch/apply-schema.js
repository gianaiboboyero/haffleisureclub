import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const sql = readFileSync('scratch/schema.sql', 'utf8');
  console.log('Connecting to database to apply schema...');
  await client.connect();
  console.log('Connected. Running SQL script...');
  // We can run the entire SQL script
  await client.query(sql);
  console.log('Schema applied successfully!');
  await client.end();
}

main().catch(err => {
  console.error('Failed to apply schema:', err);
  process.exit(1);
});
