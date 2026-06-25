import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  console.log('Inserting test AuthSession...');
  
  // We need a valid User ID from the Admins list, e.g. cmqj6be87000412bq6h7hgyhk
  const userId = 'cmqj6be87000412bq6h7hgyhk';
  const tokenHash = 'test_token_hash_' + Math.random().toString(36).substring(7);
  const id = 'test_id_' + Math.random().toString(36).substring(7);
  const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  const query = `
    INSERT INTO "AuthSession" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
    VALUES ($1, $2, $3, $4::timestamptz, NOW())
    RETURNING *
  `;
  
  const res = await client.query(query, [id, userId, tokenHash, expiresAt]);
  console.log('Inserted:', res.rows[0]);
  
  // Clean up
  await client.query('DELETE FROM "AuthSession" WHERE "id" = $1', [id]);
  console.log('Cleaned up!');
  
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
