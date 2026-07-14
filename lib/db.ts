import { Pool, PoolClient, QueryResultRow } from "pg";

const globalForDatabase = globalThis as unknown as { cryptoSugarPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

export function database() {
  if (!globalForDatabase.cryptoSugarPool) globalForDatabase.cryptoSugarPool = createPool();
  return globalForDatabase.cryptoSugarPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return database().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
