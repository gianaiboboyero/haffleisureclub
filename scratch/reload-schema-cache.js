import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Use direct connection (port 5432) to send NOTIFY
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL
});

async function main() {
  await client.connect();
  console.log('Sending NOTIFY to reload PostgREST schema cache...');
  await client.query(`NOTIFY pgrst, 'reload schema'`);
  console.log('Done! PostgREST will reload its schema cache now.');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
