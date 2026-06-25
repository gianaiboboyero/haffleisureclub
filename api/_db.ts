/**
 * Direct PostgreSQL connection pool for Vercel serverless functions.
 * Bypasses the Supabase REST API (PostgREST) which can be unreliable
 * from certain network paths. Uses DATABASE_URL with pgbouncer.
 */
import pkg from "pg";
const { Pool } = pkg;

let _pool: pkg.Pool | null = null;

export function getPool(): pkg.Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    _pool = new Pool({ connectionString, max: 3 });
  }
  return _pool;
}

export async function dbQuery<T extends pkg.QueryResultRow = pkg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pkg.QueryResult<T>> {
  return getPool().query<T>(text, params as any);
}
