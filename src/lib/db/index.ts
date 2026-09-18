import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __mupost_pg_pool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __mupost_db__: NodePgDatabase<typeof schema> | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

export function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    if (!globalThis.__mupost_pg_pool__) {
      globalThis.__mupost_pg_pool__ = createPool();
    }
    return globalThis.__mupost_pg_pool__;
  }
  if (!globalThis.__mupost_pg_pool__) {
    globalThis.__mupost_pg_pool__ = createPool();
  }
  return globalThis.__mupost_pg_pool__;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalThis.__mupost_db__) {
    globalThis.__mupost_db__ = drizzle(getPool(), { schema });
  }
  return globalThis.__mupost_db__;
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop: string | symbol) {
    const instance = getPool();
    const value = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop: string | symbol) {
    const instance = getDb();
    const value = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export { schema };
