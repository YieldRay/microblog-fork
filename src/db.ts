import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { Database as DatabaseInterface } from './database.js';
import { createTables } from './migrations.js';

// 创建原始 better-sqlite3 数据库实例
const sqliteDb = new Database('microblog.sqlite3');

// 设置 WAL 模式和外键约束
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

// 创建 Kysely 数据库实例
export const db = new Kysely<DatabaseInterface>({
  dialect: new SqliteDialect({
    database: sqliteDb,
  }),
});

// 初始化数据库表结构
export async function initializeDatabase(): Promise<void> {
  await createTables(db);
}

// 默认导出 Kysely 实例
export default db;