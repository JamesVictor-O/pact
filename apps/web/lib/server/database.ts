import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalDatabase = globalThis as typeof globalThis & { pactPool?: Pool; pactPoolConfiguration?: string };

export function database(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for agreement APIs");
  const sslSetting = process.env.DATABASE_SSL?.trim().toLowerCase();
  const ssl = sslSetting === "true" || sslSetting === "require"
    ? { rejectUnauthorized: false }
    : sslSetting === "false" || sslSetting === "disable"
      ? false
      : undefined;
  const configuration = `${connectionString}\u0000${sslSetting ?? "url"}`;
  if (globalDatabase.pactPool && globalDatabase.pactPoolConfiguration !== configuration) {
    void globalDatabase.pactPool.end().catch(() => undefined);
    globalDatabase.pactPool = undefined;
  }
  globalDatabase.pactPoolConfiguration = configuration;
  return globalDatabase.pactPool ??= new Pool({ connectionString, max: 10, ...(ssl === undefined ? {} : { ssl }) });
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try { await client.query("begin"); const result = await work(client); await client.query("commit"); return result; }
  catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function oneOrNull<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T | null> {
  const result = await database().query<T>(text, values);
  return result.rows[0] ?? null;
}
