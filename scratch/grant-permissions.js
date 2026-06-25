import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  console.log('Granting privileges on all tables, sequences, and functions to Supabase roles...');
  
  const queries = [
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated',
    
    'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres',
    'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role',
    'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon',
    'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated',
    
    'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres',
    'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role',
    'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon',
    'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated',

    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated'
  ];

  for (const query of queries) {
    console.log(`Running: ${query}`);
    await client.query(query);
  }
  
  console.log('Privileges granted successfully!');
  await client.end();
}

main().catch(err => {
  console.error('Failed to grant privileges:', err);
  process.exit(1);
});
