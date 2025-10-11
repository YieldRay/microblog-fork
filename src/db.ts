import { env } from "node:process";
import Database from "better-sqlite3";
import { Kysely, PostgresDialect, SqliteDialect } from "kysely";
import { Pool } from "pg";
import type { Database as DatabaseInterface } from "./database.ts";
import { createTables } from "./migrations.ts";

const dbType = env.DATABASE_URL_POSTGRES ? "pg" : "sqlite";

const db = new Kysely<DatabaseInterface>({
  dialect: env.DATABASE_URL_POSTGRES
    ? new PostgresDialect({
        pool: new Pool({
          connectionString: env.DATABASE_URL_POSTGRES,
        }),
      })
    : new SqliteDialect({
        database: (() => {
          const sqliteDb = new Database("microblog.sqlite3");
          sqliteDb.pragma("journal_mode = WAL");
          sqliteDb.pragma("foreign_keys = ON");
          return sqliteDb;
        })(),
      }),
});

export default db;

export async function initializeDatabase(): Promise<void> {
  await createTables(db, dbType);
}
