import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log("Connected to DB");
  
  try {
    await client.query(`
      ALTER TABLE "AdminConfig" ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Enabled RLS on AdminConfig. No policies added (only service_role can access).");
  } catch (error) {
    console.error('Error applying RLS:', error);
  }
  
  await client.end();
}

run().catch(console.error);
