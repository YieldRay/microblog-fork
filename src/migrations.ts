import { type Kysely, sql } from "kysely";
import type { Database } from "./database.ts";

/**
 * Create database table structure programmatically using Kysely
 * Replaces the original schema.sql file
 * Optimized to reduce RTT by batching operations with Promise.all()
 */
export async function createTables(
  db: Kysely<Database>,
  type: "sqlite" | "pg" = "sqlite",
): Promise<void> {
  // Step 1: Create base tables (users first, then actors that depend on users)
  await db.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", type === "pg" ? "serial" : "integer", (col) =>
      type === "pg"
        ? col.primaryKey().notNull()
        : col.primaryKey().autoIncrement().notNull(),
    )
    .addColumn("username", "text", (col) =>
      col
        .notNull()
        .unique()
        .check(sql`
        trim(lower(username)) = username
        AND username <> ''
        AND length(username) <= 50
      `),
    )
    .addColumn("password_hash", "text", (col) =>
      col.notNull().check(sql`password_hash <> ''`),
    )
    .execute();

  await db.schema
    .createTable("actors")
    .ifNotExists()
    .addColumn("id", type === "pg" ? "serial" : "integer", (col) =>
      type === "pg"
        ? col.primaryKey().notNull()
        : col.primaryKey().autoIncrement().notNull(),
    )
    .addColumn("user_id", "integer", (col) =>
      col.references("users.id").unique(),
    )
    .addColumn("uri", "text", (col) =>
      col.notNull().unique().check(sql`uri <> ''`),
    )
    .addColumn("handle", "text", (col) =>
      col.notNull().unique().check(sql`handle <> ''`),
    )
    .addColumn("name", "text")
    .addColumn("bio", "text", (col) => col.check(sql`length(bio) <= 500`))
    .addColumn("location", "text", (col) =>
      col.check(sql`length(location) <= 100`),
    )
    .addColumn("website", "text", (col) =>
      col.check(sql`website LIKE 'https://%' OR website LIKE 'http://%'`),
    )
    .addColumn("avatar_data", "text", (col) =>
      col.check(sql`avatar_data LIKE 'data:image/%' OR avatar_data IS NULL`),
    )
    .addColumn("header_data", "text", (col) =>
      col.check(sql`header_data LIKE 'data:image/%' OR header_data IS NULL`),
    )
    .addColumn("inbox_url", "text", (col) =>
      col
        .notNull()
        .unique()
        .check(sql`
        inbox_url LIKE 'https://%' OR inbox_url LIKE 'http://%'
      `),
    )
    .addColumn("shared_inbox_url", "text", (col) =>
      col.check(sql`
        shared_inbox_url LIKE 'https://%' OR shared_inbox_url LIKE 'http://%'
      `),
    )
    .addColumn("url", "text", (col) =>
      col.check(sql`url LIKE 'https://%' OR url LIKE 'http://%'`),
    )
    .addColumn("created", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`).check(sql`created <> ''`),
    )
    .addColumn("updated", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`).check(sql`updated <> ''`),
    )
    .execute();

  // Step 2: Create remaining tables in parallel (they all depend on users/actors)
  await Promise.all([
    // Keys table
    db.schema
      .createTable("keys")
      .ifNotExists()
      .addColumn("user_id", "integer", (col) =>
        col.notNull().references("users.id"),
      )
      .addColumn("type", "text", (col) =>
        col.notNull().check(sql`type IN ('RSASSA-PKCS1-v1_5', 'Ed25519')`),
      )
      .addColumn("private_key", "text", (col) =>
        col.notNull().check(sql`private_key <> ''`),
      )
      .addColumn("public_key", "text", (col) =>
        col.notNull().check(sql`public_key <> ''`),
      )
      .addColumn("created", "text", (col) =>
        col
          .notNull()
          .defaultTo(sql`CURRENT_TIMESTAMP`)
          .check(sql`created <> ''`),
      )
      .addPrimaryKeyConstraint("keys_pk", ["user_id", "type"])
      .execute(),

    // Follows table
    db.schema
      .createTable("follows")
      .ifNotExists()
      .addColumn("following_id", "integer", (col) =>
        col.references("actors.id"),
      )
      .addColumn("follower_id", "integer", (col) => col.references("actors.id"))
      .addColumn("created", "text", (col) =>
        col
          .notNull()
          .defaultTo(sql`CURRENT_TIMESTAMP`)
          .check(sql`created <> ''`),
      )
      .addPrimaryKeyConstraint("follows_pk", ["following_id", "follower_id"])
      .execute(),

    // Posts table
    db.schema
      .createTable("posts")
      .ifNotExists()
      .addColumn("id", type === "pg" ? "serial" : "integer", (col) =>
        type === "pg"
          ? col.primaryKey().notNull()
          : col.primaryKey().autoIncrement().notNull(),
      )
      .addColumn("uri", "text", (col) =>
        col.notNull().unique().check(sql`uri <> ''`),
      )
      .addColumn("actor_id", "integer", (col) =>
        col.notNull().references("actors.id"),
      )
      .addColumn("content", "text", (col) => col.notNull())
      .addColumn("url", "text", (col) =>
        col.check(sql`url LIKE 'https://%' OR url LIKE 'http://%'`),
      )
      .addColumn("created", "text", (col) =>
        col
          .notNull()
          .defaultTo(sql`CURRENT_TIMESTAMP`)
          .check(sql`created <> ''`),
      )
      .execute(),
  ]);

  // Step 3: Create tables that depend on posts in parallel
  await Promise.all([
    // Mentions table
    db.schema
      .createTable("mentions")
      .ifNotExists()
      .addColumn("id", type === "pg" ? "serial" : "integer", (col) =>
        type === "pg"
          ? col.primaryKey().notNull()
          : col.primaryKey().autoIncrement().notNull(),
      )
      .addColumn("post_id", "integer", (col) =>
        col.notNull().references("posts.id").onDelete("cascade"),
      )
      .addColumn("mentioned_actor_id", "integer", (col) =>
        col.notNull().references("actors.id").onDelete("cascade"),
      )
      .addColumn("created", "text", (col) =>
        col
          .notNull()
          .defaultTo(sql`CURRENT_TIMESTAMP`)
          .check(sql`created <> ''`),
      )
      .execute(),

    // Notifications table
    db.schema
      .createTable("notifications")
      .ifNotExists()
      .addColumn("id", type === "pg" ? "serial" : "integer", (col) =>
        type === "pg"
          ? col.primaryKey().notNull()
          : col.primaryKey().autoIncrement().notNull(),
      )
      .addColumn("recipient_actor_id", "integer", (col) =>
        col.notNull().references("actors.id").onDelete("cascade"),
      )
      .addColumn("type", "text", (col) =>
        col.notNull().check(sql`type IN ('mention', 'follow', 'like')`),
      )
      .addColumn("related_post_id", "integer", (col) =>
        col.references("posts.id").onDelete("cascade"),
      )
      .addColumn("related_actor_id", "integer", (col) =>
        col.references("actors.id").onDelete("cascade"),
      )
      .addColumn("message", "text", (col) =>
        col.notNull().check(sql`message <> ''`),
      )
      .addColumn("is_read", "integer", (col) =>
        col.notNull().defaultTo(0).check(sql`is_read IN (0, 1)`),
      )
      .addColumn("created", "text", (col) =>
        col
          .notNull()
          .defaultTo(sql`CURRENT_TIMESTAMP`)
          .check(sql`created <> ''`),
      )
      .execute(),
  ]);

  // Step 4: Create all indexes in parallel to improve query performance
  await Promise.all([
    // Indexes for mentions table
    db.schema
      .createIndex("idx_mentions_post_id")
      .ifNotExists()
      .on("mentions")
      .column("post_id")
      .execute(),

    db.schema
      .createIndex("idx_mentions_mentioned_actor_id")
      .ifNotExists()
      .on("mentions")
      .column("mentioned_actor_id")
      .execute(),

    // Indexes for notifications table
    db.schema
      .createIndex("idx_notifications_recipient_actor_id")
      .ifNotExists()
      .on("notifications")
      .column("recipient_actor_id")
      .execute(),

    db.schema
      .createIndex("idx_notifications_type")
      .ifNotExists()
      .on("notifications")
      .column("type")
      .execute(),

    db.schema
      .createIndex("idx_notifications_is_read")
      .ifNotExists()
      .on("notifications")
      .column("is_read")
      .execute(),

    db.schema
      .createIndex("idx_notifications_created")
      .ifNotExists()
      .on("notifications")
      .column("created")
      .execute(),
  ]);
}

/**
 * Drop all tables (for testing or reset)
 */
export async function dropTables(db: Kysely<Database>): Promise<void> {
  // Drop tables in reverse order of dependencies
  await db.schema.dropTable("notifications").ifExists().execute();
  await db.schema.dropTable("mentions").ifExists().execute();
  await db.schema.dropTable("posts").ifExists().execute();
  await db.schema.dropTable("follows").ifExists().execute();
  await db.schema.dropTable("keys").ifExists().execute();
  await db.schema.dropTable("actors").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
}
