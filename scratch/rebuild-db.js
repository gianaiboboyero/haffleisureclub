import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('Connecting to database...');
  await client.connect();
  
  console.log('Dropping and recreating public schema (clean slate)...');
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO postgres');
  await client.query('GRANT ALL ON SCHEMA public TO public');
  
  console.log('Loading schema.sql...');
  const sql = readFileSync('scratch/schema.sql', 'utf8');
  
  console.log('Applying schema...');
  await client.query(sql);
  
  console.log('Database rebuilt successfully with all tables, enums, indexes, and constraints!');
  await client.end();
}

main().catch(err => {
  console.error('Failed to rebuild database:', err);
  process.exit(1);
});
