import { federation } from "@fedify/fedify/x/hono";
import { Hono } from "hono";
import { stringifyEntities } from "stringify-entities";
import db from "./db.ts";
import fedi from "./federation.ts";
import {
  FollowerList,
  FollowingList,
  Home,
  Layout,
  PostList,
  PostPage,
  Profile,
  SetupForm,
} from "./views.tsx";
import { Create, Follow, isActor, lookupObject, Note } from "@fedify/fedify";

const app = new Hono();
app.use(federation(fedi, () => undefined));

app.get("/", async (c) => {
  const user = await db
    .selectFrom('users')
    .innerJoin('actors', 'users.id', 'actors.user_id')
    .selectAll()
    .limit(1)
    .executeTakeFirst();
  if (user == null) return c.redirect("/setup");

  const posts = await db
    .selectFrom('posts')
    .innerJoin('actors', 'posts.actor_id', 'actors.id')
    .selectAll()
    .where((eb) => eb.or([
      eb('posts.actor_id', '=', user.id),
      eb('posts.actor_id', 'in',
        eb.selectFrom('follows')
          .select('following_id')
          .where('follower_id', '=', user.id)
      )
    ]))
    .orderBy('posts.created', 'desc')
    .execute();
  return c.html(
    <Layout>
      <Home user={user} posts={posts} />
    </Layout>,
  );
});

app.get("/setup", async (c) => {
  // Check if the user already exists
  const user = await db
    .selectFrom('users')
    .innerJoin('actors', 'users.id', 'actors.user_id')
    .selectAll()
    .limit(1)
    .executeTakeFirst();
  if (user != null) return c.redirect("/");

  return c.html(
    <Layout>
      <SetupForm />
    </Layout>,
  );
});

app.post("/setup", async (c) => {
  // Check if the user already exists
  const user = await db
    .selectFrom('users')
    .innerJoin('actors', 'users.id', 'actors.user_id')
    .selectAll()
    .limit(1)
    .executeTakeFirst();
  if (user != null) return c.redirect("/");

  const form = await c.req.formData();
  const username = form.get("username");
  if (typeof username !== "string" || !username.match(/^[a-z0-9_-]{1,50}$/)) {
    return c.redirect("/setup");
  }
  const name = form.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    return c.redirect("/setup");
  }
  const url = new URL(c.req.url);
  const handle = `@${username}@${url.host}`;
  const ctx = fedi.createContext(c.req.raw, undefined);
  
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('users')
      .values({ username })
      .onConflict((oc) => oc.column('username').doUpdateSet({ username }))
      .execute();
    
    await trx
      .insertInto('actors')
      .values({
        user_id: 1,
        uri: ctx.getActorUri(username).href,
        handle,
        name,
        inbox_url: ctx.getInboxUri(username).href,
        shared_inbox_url: ctx.getInboxUri().href,
        url: ctx.getActorUri(username).href,
      })
      .onConflict((oc) => oc.column('user_id').doUpdateSet({
        uri: (eb) => eb.ref('excluded.uri'),
        handle: (eb) => eb.ref('excluded.handle'),
        name: (eb) => eb.ref('excluded.name'),
        inbox_url: (eb) => eb.ref('excluded.inbox_url'),
        shared_inbox_url: (eb) => eb.ref('excluded.shared_inbox_url'),
        url: (eb) => eb.ref('excluded.url'),
      }))
      .execute();
  });
  return c.redirect("/");
});

app.get("/users/:username", async (c) => {
  const user = await db
    .selectFrom('users')
    .innerJoin('actors', 'users.id', 'actors.user_id')
    .selectAll()
    .where('username', '=', c.req.param("username"))
    .executeTakeFirst();
  if (user == null) return c.notFound();

  const followingResult = await db
    .selectFrom('follows')
    .innerJoin('actors', 'follows.follower_id', 'actors.id')
    .select((eb) => eb.fn.count('follows.following_id').as('following'))
    .where('actors.user_id', '=', user.id)
    .executeTakeFirst();
  const following = Number(followingResult?.following ?? 0);

  const followersResult = await db
    .selectFrom('follows')
    .innerJoin('actors', 'follows.following_id', 'actors.id')
    .select((eb) => eb.fn.count('follows.follower_id').as('followers'))
    .where('actors.user_id', '=', user.id)
    .executeTakeFirst();
  const followers = Number(followersResult?.followers ?? 0);

  const posts = await db
    .selectFrom('posts')
    .innerJoin('actors', 'posts.actor_id', 'actors.id')
    .selectAll()
    .where('actors.user_id', '=', user.user_id)
    .orderBy('posts.created', 'desc')
    .execute();
  const url = new URL(c.req.url);
  const handle = `@${user.username}@${url.host}`;
  return c.html(
    <Layout>
      <Profile
        name={user.name ?? user.username}
        username={user.username}
        handle={handle}
        following={following}
        followers={followers}
      />
      <PostList posts={posts} />
    </Layout>,
  );
});

app.post("/users/:username/following", async (c) => {
  const username = c.req.param("username");
  const form = await c.req.formData();
  const handle = form.get("actor");
  if (typeof handle !== "string") {
    return c.text("Invalid actor handle or URL", 400);
  }
  const actor = await lookupObject(handle);
  if (!isActor(actor)) {
    return c.text("Invalid actor handle or URL", 400);
  }
  const ctx = fedi.createContext(c.req.raw, undefined);
  await ctx.sendActivity(
    { identifier: username },
    actor,
    new Follow({
      actor: ctx.getActorUri(username),
      object: actor.id,
      to: actor.id,
    }),
  );
  return c.text("Successfully sent a follow request");
});

app.get("/users/:username/following", async (c) => {
  const following = await db
    .selectFrom('follows')
    .innerJoin('actors as followers', 'follows.follower_id', 'followers.id')
    .innerJoin('actors as following', 'follows.following_id', 'following.id')
    .innerJoin('users', 'users.id', 'followers.user_id')
    .select([
      'following.id',
      'following.user_id',
      'following.uri',
      'following.handle',
      'following.name',
      'following.inbox_url',
      'following.shared_inbox_url',
      'following.url',
      'following.created'
    ])
    .where('users.username', '=', c.req.param("username"))
    .orderBy('follows.created', 'desc')
    .execute();
  return c.html(
    <Layout>
      <FollowingList following={following} />
    </Layout>,
  );
});

app.get("/users/:username/followers", async (c) => {
  const followers = await db
    .selectFrom('follows')
    .innerJoin('actors as followers', 'follows.follower_id', 'followers.id')
    .innerJoin('actors as following', 'follows.following_id', 'following.id')
    .innerJoin('users', 'users.id', 'following.user_id')
    .select([
      'followers.id',
      'followers.user_id',
      'followers.uri',
      'followers.handle',
      'followers.name',
      'followers.inbox_url',
      'followers.shared_inbox_url',
      'followers.url',
      'followers.created'
    ])
    .where('users.username', '=', c.req.param("username"))
    .orderBy('follows.created', 'desc')
    .execute();
  return c.html(
    <Layout>
      <FollowerList followers={followers} />
    </Layout>,
  );
});

app.post("/users/:username/posts", async (c) => {
  const username = c.req.param("username");
  const actor = await db
    .selectFrom('actors')
    .innerJoin('users', 'users.id', 'actors.user_id')
    .selectAll('actors')
    .where('users.username', '=', username)
    .executeTakeFirst();
  if (actor == null) return c.redirect("/setup");
  const form = await c.req.formData();
  const content = form.get("content")?.toString();
  if (content == null || content.trim() === "") {
    return c.text("Content is required", 400);
  }
  const ctx = fedi.createContext(c.req.raw, undefined);
  const post = await db.transaction().execute(async (trx) => {
    const insertedPost = await trx
      .insertInto('posts')
      .values({
        uri: 'https://localhost/',
        actor_id: actor.id,
        content: stringifyEntities(content, { escapeOnly: true }),
      })
      .returningAll()
      .executeTakeFirst();
    
    if (insertedPost == null) return null;
    
    const url = ctx.getObjectUri(Note, {
      identifier: username,
      id: insertedPost.id.toString(),
    }).href;
    
    await trx
      .updateTable('posts')
      .set({ uri: url, url: url })
      .where('id', '=', insertedPost.id)
      .execute();
    
    return { ...insertedPost, uri: url, url: url };
  });
  if (post == null) return c.text("Failed to create post", 500);
  const noteArgs = { identifier: username, id: post.id.toString() };
  const note = await ctx.getObject(Note, noteArgs);
  await ctx.sendActivity(
    { identifier: username },
    "followers",
    new Create({
      id: new URL("#activity", note?.id ?? undefined),
      object: note,
      actors: note?.attributionIds,
      tos: note?.toIds,
      ccs: note?.ccIds,
    }),
  );
  return c.redirect(ctx.getObjectUri(Note, noteArgs).href);
});

app.get("/users/:username/posts/:id", async (c) => {
  const post = await db
    .selectFrom('posts')
    .innerJoin('actors', 'actors.id', 'posts.actor_id')
    .innerJoin('users', 'users.id', 'actors.user_id')
    .selectAll()
    .where('users.username', '=', c.req.param("username"))
    .where('posts.id', '=', Number(c.req.param("id")))
    .executeTakeFirst();
  if (post == null) return c.notFound();

  const followingResult = await db
    .selectFrom('follows')
    .select((eb) => [
      eb.fn.sum(
        eb.case()
          .when('follows.follower_id', '=', post.actor_id)
          .then(1)
          .else(0)
          .end()
      ).as('following'),
      eb.fn.sum(
        eb.case()
          .when('follows.following_id', '=', post.actor_id)
          .then(1)
          .else(0)
          .end()
      ).as('followers')
    ])
    .executeTakeFirst();
  
  const following = Number(followingResult?.following ?? 0);
  const followers = Number(followingResult?.followers ?? 0);
  return c.html(
    <Layout>
      <PostPage
        name={post.name ?? post.username}
        username={post.username}
        handle={post.handle}
        following={following}
        followers={followers}
        post={post}
      />
    </Layout>,
  );
});

export default app;
