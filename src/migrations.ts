import { Kysely, sql } from 'kysely';
import type { Database } from './database.js';

/**
 * 使用 Kysely 编程式创建数据库表结构
 * 替代原有的 schema.sql 文件
 */
export async function createTables(db: Kysely<Database>): Promise<void> {
  // 创建 users 表
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => 
      col.primaryKey().notNull().check(sql`id = 1`)
    )
    .addColumn('username', 'text', (col) => 
      col.notNull().unique().check(sql`
        trim(lower(username)) = username 
        AND username <> '' 
        AND length(username) <= 50
      `)
    )
    .execute();

  // 创建 actors 表
  await db.schema
    .createTable('actors')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().notNull())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').unique()
    )
    .addColumn('uri', 'text', (col) => 
      col.notNull().unique().check(sql`uri <> ''`)
    )
    .addColumn('handle', 'text', (col) => 
      col.notNull().unique().check(sql`handle <> ''`)
    )
    .addColumn('name', 'text')
    .addColumn('inbox_url', 'text', (col) => 
      col.notNull().unique().check(sql`
        inbox_url LIKE 'https://%' OR inbox_url LIKE 'http://%'
      `)
    )
    .addColumn('shared_inbox_url', 'text', (col) => 
      col.check(sql`
        shared_inbox_url LIKE 'https://%' OR shared_inbox_url LIKE 'http://%'
      `)
    )
    .addColumn('url', 'text', (col) => 
      col.check(sql`url LIKE 'https://%' OR url LIKE 'http://%'`)
    )
    .addColumn('created', 'text', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`).check(sql`created <> ''`)
    )
    .execute();

  // 创建 keys 表
  await db.schema
    .createTable('keys')
    .ifNotExists()
    .addColumn('user_id', 'integer', (col) => 
      col.notNull().references('users.id')
    )
    .addColumn('type', 'text', (col) => 
      col.notNull().check(sql`type IN ('RSASSA-PKCS1-v1_5', 'Ed25519')`)
    )
    .addColumn('private_key', 'text', (col) => 
      col.notNull().check(sql`private_key <> ''`)
    )
    .addColumn('public_key', 'text', (col) => 
      col.notNull().check(sql`public_key <> ''`)
    )
    .addColumn('created', 'text', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`).check(sql`created <> ''`)
    )
    .addPrimaryKeyConstraint('keys_pk', ['user_id', 'type'])
    .execute();

  // 创建 follows 表
  await db.schema
    .createTable('follows')
    .ifNotExists()
    .addColumn('following_id', 'integer', (col) => 
      col.references('actors.id')
    )
    .addColumn('follower_id', 'integer', (col) => 
      col.references('actors.id')
    )
    .addColumn('created', 'text', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`).check(sql`created <> ''`)
    )
    .addPrimaryKeyConstraint('follows_pk', ['following_id', 'follower_id'])
    .execute();

  // 创建 posts 表
  await db.schema
    .createTable('posts')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().notNull())
    .addColumn('uri', 'text', (col) => 
      col.notNull().unique().check(sql`uri <> ''`)
    )
    .addColumn('actor_id', 'integer', (col) => 
      col.notNull().references('actors.id')
    )
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => 
      col.check(sql`url LIKE 'https://%' OR url LIKE 'http://%'`)
    )
    .addColumn('created', 'text', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`).check(sql`created <> ''`)
    )
    .execute();
}

/**
 * 删除所有表（用于测试或重置）
 */
export async function dropTables(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('posts').ifExists().execute();
  await db.schema.dropTable('follows').ifExists().execute();
  await db.schema.dropTable('keys').ifExists().execute();
  await db.schema.dropTable('actors').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}