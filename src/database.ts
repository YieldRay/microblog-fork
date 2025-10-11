import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// 表类型定义 - 使用 kysely 最佳实践
export interface UsersTable {
  id: Generated<number>; // 自增主键
  username: string;
}

export interface ActorsTable {
  id: Generated<number>; // 自增主键
  user_id: number | null;
  uri: string;
  handle: string;
  name: string | null;
  inbox_url: string;
  shared_inbox_url: string | null;
  url: string | null;
  created: Generated<string>; // 数据库自动生成的时间戳
}

export interface KeysTable {
  user_id: number;
  type: 'RSASSA-PKCS1-v1_5' | 'Ed25519';
  private_key: string;
  public_key: string;
  created: Generated<string>; // 数据库自动生成的时间戳
}

export interface FollowsTable {
  following_id: number;
  follower_id: number;
  created: Generated<string>; // 数据库自动生成的时间戳
}

export interface PostsTable {
  id: Generated<number>; // 自增主键
  uri: string;
  actor_id: number;
  content: string;
  url: string | null;
  created: Generated<string>; // 数据库自动生成的时间戳
}

// 数据库接口定义
export interface Database {
  users: UsersTable;
  actors: ActorsTable;
  keys: KeysTable;
  follows: FollowsTable;
  posts: PostsTable;
}

// 使用 kysely 内置类型生成便捷类型别名
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