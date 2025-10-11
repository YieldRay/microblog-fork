import type { Generated, Insertable, Selectable, Updateable } from "kysely";

// Database table type definitions - following Kysely best practices
export interface UsersTable {
  id: Generated<number>; // Auto-incrementing primary key
  username: string;
  password_hash: string; // Password hash value
}

export interface ActorsTable {
  id: Generated<number>; // Auto-incrementing primary key
  user_id: number | null;
  uri: string;
  handle: string;
  name: string | null;
  bio: string | null; // Personal biography
  location: string | null; // Location information
  website: string | null; // Personal website
  avatar_data: string | null; // Avatar data (base64 data URL)
  header_data: string | null; // Header banner image data (base64 data URL)
  inbox_url: string;
  shared_inbox_url: string | null;
  url: string | null;
  created: Generated<string>; // Database auto-generated timestamp
  updated: Generated<string>; // Last updated timestamp
}

export interface KeysTable {
  user_id: number;
  type: "RSASSA-PKCS1-v1_5" | "Ed25519";
  private_key: string;
  public_key: string;
  created: Generated<string>; // Database auto-generated timestamp
}

export interface FollowsTable {
  following_id: number;
  follower_id: number;
  created: Generated<string>; // Database auto-generated timestamp
}

export interface PostsTable {
  id: Generated<number>; // Auto-incrementing primary key
  uri: string;
  actor_id: number;
  content: string;
  url: string | null;
  created: Generated<string>; // Database auto-generated timestamp
}

export interface MentionsTable {
  id: Generated<number>; // Auto-incrementing primary key
  post_id: number; // Associated post ID (foreign key to posts.id)
  mentioned_actor_id: number; // Mentioned user ID (foreign key to actors.id)
  created: Generated<string>; // Creation timestamp
}

export interface NotificationsTable {
  id: Generated<number>; // Auto-incrementing primary key
  recipient_actor_id: number; // Notification recipient user ID (foreign key to actors.id)
  type: "mention" | "follow" | "like" | "direct"; // Notification type
  related_post_id: number | null; // Related post ID (nullable, foreign key to posts.id)
  related_actor_id: number | null; // Related user ID (nullable, foreign key to actors.id)
  message: string; // Notification message content
  is_read: number; // Whether the notification has been read (0 = false, 1 = true)
  created: Generated<string>; // Creation timestamp
}

// Database interface definition
export interface Database {
  users: UsersTable;
  actors: ActorsTable;
  keys: KeysTable;
  follows: FollowsTable;
  posts: PostsTable;
  mentions: MentionsTable;
  notifications: NotificationsTable;
}

// Convenient type aliases using Kysely built-in types
export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Actor = Selectable<ActorsTable>;
export type NewActor = Insertable<ActorsTable>;
export type ActorUpdate = Updateable<ActorsTable>;

export type Key = Selectable<KeysTable>;
export type NewKey = Insertable<KeysTable>;
export type KeyUpdate = Updateable<KeysTable>;

export type Follow = Selectable<FollowsTable>;
export type NewFollow = Insertable<FollowsTable>;
export type FollowUpdate = Updateable<FollowsTable>;

export type Post = Selectable<PostsTable>;
export type NewPost = Insertable<PostsTable>;
export type PostUpdate = Updateable<PostsTable>;

export type Mention = Selectable<MentionsTable>;
export type NewMention = Insertable<MentionsTable>;
export type MentionUpdate = Updateable<MentionsTable>;

export type Notification = Selectable<NotificationsTable>;
export type NewNotification = Insertable<NotificationsTable>;
export type NotificationUpdate = Updateable<NotificationsTable>;
