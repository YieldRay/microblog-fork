import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { Database as DatabaseInterface } from './database.js';
import { createTables } from './migrations.js';

const sqliteDb = new Database('microblog.sqlite3');


sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

const db = new Kysely<DatabaseInterface>({
  dialect: new SqliteDialect({
    database: sqliteDb,
  }),
});

export default db;

export async function initializeDatabase(): Promise<void> {
  await createTables(db);
}
