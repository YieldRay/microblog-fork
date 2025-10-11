import { federation } from "@fedify/fedify/x/hono";
import { Hono } from "hono";
import { Update, PUBLIC_COLLECTION } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { encodeBase64 } from "hono/utils/encode";
import {
  FollowerList,
  FollowingList,
  Home,
  Layout,
  LoginForm,
  PostList,
  PostPage,
  Profile,
  ProfileEditForm,
  RegisterForm,
  NotificationPage,
  MessagePage,
} from "./views.tsx";
import { Create, Follow, isActor, lookupObject, Note } from "@fedify/fedify";
import db from "./db.ts";
import { logger } from "./logging.ts";
import { sanitizeUserContent } from "./security.ts";
import fedi, { sendUndoFollow } from "./federation.ts";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  authMiddleware,
  optionalAuthMiddleware,
} from "./auth.ts";
import {
  processMentions,
  parseMentions,
  findMentionedUsers,
} from "./mentions.ts";
import type { User } from "./database.ts";

// Extend Hono context types
type Variables = {
  user?: { userId: number; username: string };
};

const app = new Hono<{ Variables: Variables }>();

// Add Content Security Policy middleware
app.use("*", async (c, next) => {
  // Set strict CSP headers
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "font-src 'self' https://cdn.jsdelivr.net",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  );

  // Other security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  await next();
});

app.use(federation(fedi, () => undefined));

app.get("/", optionalAuthMiddleware, async (c) => {
  const authUser = c.get("user");

  // If no authenticated user, redirect to login
  if (!authUser) {
    return c.redirect("/login");
  }

  // Get complete information for the authenticated user
  const user = await db
    .selectFrom("users")
    .innerJoin("actors", "users.id", "actors.user_id")
    .selectAll()
    .where("users.id", "=", authUser.userId)
    .executeTakeFirst();

  if (user == null) return c.redirect("/login");

  const posts = await db
    .selectFrom("posts")
    .innerJoin("actors", "posts.actor_id", "actors.id")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb("posts.actor_id", "=", user.id),
        eb(
          "posts.actor_id",
          "in",
          eb
            .selectFrom("follows")
            .select("following_id")
            .where("follower_id", "=", user.id),
        ),
      ]),
    )
    .orderBy("posts.created", "desc")
    .execute();

  // Get unread notification count
  const unreadResult = await db
    .selectFrom("notifications")
    .select((eb) => eb.fn.count("id").as("count"))
    .where("recipient_actor_id", "=", user.id)
    .where("is_read", "=", 0)
    .executeTakeFirst();

  const unreadCount = Number(unreadResult?.count ?? 0);

  return c.html(
    <Layout>
      <Home user={user} posts={posts} unreadNotificationCount={unreadCount} />
    </Layout>,
  );
});

app.get("/users/:username", optionalAuthMiddleware, async (c) => {
  const user = await db
    .selectFrom("users")
    .innerJoin("actors", "users.id", "actors.user_id")
    .selectAll()
    .where("username", "=", c.req.param("username"))
    .executeTakeFirst();
  if (user == null) return c.notFound();

  const authUser = c.get("user");
  const isOwnProfile = authUser?.username === user.username;

  const followingResult = await db
    .selectFrom("follows")
    .innerJoin("actors", "follows.follower_id", "actors.id")
    .select((eb) => eb.fn.count("follows.following_id").as("following"))
    .where("actors.user_id", "=", user.id)
    .executeTakeFirst();
  const following = Number(followingResult?.following ?? 0);

  const followersResult = await db
    .selectFrom("follows")
    .innerJoin("actors", "follows.following_id", "actors.id")
    .select((eb) => eb.fn.count("follows.follower_id").as("followers"))
    .where("actors.user_id", "=", user.id)
    .executeTakeFirst();
  const followers = Number(followersResult?.followers ?? 0);

  // Get posts for user's profile page
  // Include both user's own posts and posts sent to the user (inbox via mentions)
  const posts = await db
    .selectFrom("posts")
    .innerJoin("actors", "posts.actor_id", "actors.id")
    .selectAll()
    .where((eb) =>
      eb.or([
        // User's own posts
        eb("actors.user_id", "=", user.user_id),
        // Posts mentioning this user (inbox)
        eb(
          "posts.id",
          "in",
          eb
            .selectFrom("mentions")
            .select("post_id")
            .where("mentioned_actor_id", "=", user.id),
        ),
      ]),
    )
    .orderBy("posts.created", "desc")
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
        bio={user.bio}
        location={user.location}
        website={user.website}
        avatar_data={user.avatar_data}
        header_data={user.header_data}
        isOwnProfile={isOwnProfile}
      />
      <PostList posts={posts} />
    </Layout>,
  );
});

app.post("/users/:username/following", authMiddleware, async (c) => {
  const username = c.req.param("username");
  const form = await c.req.formData();
  const handle = form.get("actor");
  if (typeof handle !== "string") {
    return c.html(
      <Layout>
        <MessagePage
          title="Invalid Input"
          message="Please provide a valid user handle or URL."
          type="error"
          backUrl={`/users/${username}/following`}
          backText="Back to Following"
        />
      </Layout>,
    );
  }
  const actor = await lookupObject(handle);
  if (!isActor(actor)) {
    return c.html(
      <Layout>
        <MessagePage
          title="User Not Found"
          message="Unable to find the specified user. Please check if the user handle or URL is correct."
          type="error"
          backUrl={`/users/${username}/following`}
          backText="Back to Following"
        />
      </Layout>,
    );
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
  return c.html(
    <Layout>
      <MessagePage
        title="Follow Request Sent"
        message="Your follow request has been sent successfully. Waiting for confirmation."
        type="success"
        backUrl={`/users/${username}/following`}
        backText="Back to Following"
      />
    </Layout>,
  );
});

// Unfollow route
app.post("/users/:username/unfollow", authMiddleware, async (c) => {
  const username = c.req.param("username");
  const authUser = c.get("user");

  if (!authUser) {
    return c.redirect("/login");
  }

  const form = await c.req.formData();
  const actorId = form.get("actorId");

  if (typeof actorId !== "string") {
    return c.html(
      <Layout>
        <MessagePage
          title="Operation Failed"
          message="Invalid user ID. Unable to perform unfollow operation."
          type="error"
          backUrl={`/users/${username}/following`}
          backText="Back to Following"
        />
      </Layout>,
    );
  }

  // Get current user's actor
  const currentUserActor = await db
    .selectFrom("actors")
    .select(["id"])
    .where("user_id", "=", authUser.userId)
    .executeTakeFirst();

  if (!currentUserActor) {
    return c.html(
      <Layout>
        <MessagePage
          title="User Not Found"
          message="Current user information not found. Please log in again."
          type="error"
          backUrl="/login"
          backText="Login Again"
        />
      </Layout>,
    );
  }

  // Get the target actor's URI for ActivityPub
  const targetActor = await db
    .selectFrom("actors")
    .select(["uri"])
    .where("id", "=", Number(actorId))
    .executeTakeFirst();

  // Remove follow relationship from database
  await db
    .deleteFrom("follows")
    .where("follower_id", "=", currentUserActor.id)
    .where("following_id", "=", Number(actorId))
    .execute();

  // Send ActivityPub Undo Follow activity
  if (targetActor) {
    try {
      const ctx = fedi.createContext(c.req.raw, undefined);
      await sendUndoFollow(ctx, username, targetActor.uri);
    } catch (error) {
      logger.error("Failed to send Undo Follow activity: {error}", { error });
      // Don't block the unfollow operation, just log the error
    }
  }

  return c.redirect(`/users/${username}/following`);
});

app.get("/users/:username/following", optionalAuthMiddleware, async (c) => {
  const username = c.req.param("username");
  const authUser = c.get("user");
  const isOwnProfile = authUser?.username === username;

  const following = await db
    .selectFrom("follows")
    .innerJoin("actors as followers", "follows.follower_id", "followers.id")
    .innerJoin("actors as following", "follows.following_id", "following.id")
    .innerJoin("users", "users.id", "followers.user_id")
    .selectAll("following")
    .where("users.username", "=", username)
    .orderBy("follows.created", "desc")
    .execute();
  return c.html(
    <Layout>
      <FollowingList
        following={following}
        username={username}
        isOwnProfile={isOwnProfile}
      />
    </Layout>,
  );
});

app.get("/users/:username/followers", async (c) => {
  const username = c.req.param("username");
  const followers = await db
    .selectFrom("follows")
    .innerJoin("actors as followers", "follows.follower_id", "followers.id")
    .innerJoin("actors as following", "follows.following_id", "following.id")
    .innerJoin("users", "users.id", "following.user_id")
    .selectAll("followers")
    .where("users.username", "=", username)
    .orderBy("follows.created", "desc")
    .execute();
  return c.html(
    <Layout>
      <FollowerList followers={followers} username={username} />
    </Layout>,
  );
});

app.post("/users/:username/posts", authMiddleware, async (c) => {
  const username = c.req.param("username");
  const actor = await db
    .selectFrom("actors")
    .innerJoin("users", "users.id", "actors.user_id")
    .selectAll("actors")
    .where("users.username", "=", username)
    .executeTakeFirst();
  if (actor == null) return c.redirect("/");

  const form = await c.req.formData();
  const content = form.get("content")?.toString();
  if (content == null || content.trim() === "") {
    return c.html(
      <Layout>
        <MessagePage
          title="Content Required"
          message="Please enter post content before publishing."
          type="error"
          backUrl="/"
          backText="Back to Home"
        />
      </Layout>,
    );
  }

  const ctx = fedi.createContext(c.req.raw, undefined);

  const post = await db.transaction().execute(async (trx) => {
    // Create post
    const insertedPost = await trx
      .insertInto("posts")
      .values({
        uri: "https://localhost/",
        actor_id: actor.id,
        content: sanitizeUserContent(content),
      })
      .returningAll()
      .executeTakeFirst();

    if (insertedPost == null) return null;

    const url = ctx.getObjectUri(Note, {
      identifier: username,
      id: insertedPost.id.toString(),
    }).href;

    await trx
      .updateTable("posts")
      .set({ uri: url, url: url })
      .where("id", "=", insertedPost.id)
      .execute();

    return { ...insertedPost, uri: url, url: url };
  });

  if (post == null) {
    return c.html(
      <Layout>
        <MessagePage
          title="Publish Failed"
          message="Failed to publish post. Please try again later."
          type="error"
          backUrl="/"
          backText="Back to Home"
        />
      </Layout>,
    );
  }

  try {
    await processMentions(post.id, content, actor.id);
  } catch (error) {
    logger.error("Error processing mentions: {error}", { error });
  }

  const noteArgs = { identifier: username, id: post.id.toString() };
  const note = await ctx.getObject(Note, noteArgs);

  // Get mentioned users to send to their inboxes
  const mentionedUsernames = parseMentions(content);
  const mentionedActors = await findMentionedUsers(mentionedUsernames);

  // Create Create activity
  const createActivity = new Create({
    id: new URL("#activity", note?.id ?? undefined),
    object: note,
    actors: note?.attributionIds,
    tos: note?.toIds,
    ccs: note?.ccIds,
  });

  // Send to followers
  await ctx.sendActivity({ identifier: username }, "followers", createActivity);

  // Send to mentioned users (if they are not followers)
  for (const mentionedActor of mentionedActors) {
    try {
      // Check if mentioned user is already a follower
      const isFollower = await db
        .selectFrom("follows")
        .select(["following_id"])
        .where("following_id", "=", actor.id)
        .where("follower_id", "=", mentionedActor.id)
        .executeTakeFirst();

      // If not a follower, send directly to their inbox
      if (!isFollower && mentionedActor.inbox_url) {
        await ctx.sendActivity(
          { identifier: username },
          {
            id: new URL(mentionedActor.uri),
            inboxId: new URL(mentionedActor.inbox_url),
            endpoints: mentionedActor.shared_inbox_url
              ? { sharedInbox: new URL(mentionedActor.shared_inbox_url) }
              : null,
          },
          createActivity,
        );
      }
    } catch (error) {
      logger.error(
        `Error sending mention notification to user ${mentionedActor.handle}: {error}`,
        { error },
      );
      // Continue processing other users, don't interrupt due to single user sending failure
    }
  }
  return c.redirect(ctx.getObjectUri(Note, noteArgs).href);
});

app.get("/users/:username/posts/:id", async (c) => {
  const post = await db
    .selectFrom("posts")
    .innerJoin("actors", "actors.id", "posts.actor_id")
    .innerJoin("users", "users.id", "actors.user_id")
    .selectAll()
    .where("users.username", "=", c.req.param("username"))
    .where("posts.id", "=", Number(c.req.param("id")))
    .executeTakeFirst();
  if (post == null) return c.notFound();

  const followingResult = await db
    .selectFrom("follows")
    .select((eb) => [
      eb.fn
        .sum(
          eb
            .case()
            .when("follows.follower_id", "=", post.actor_id)
            .then(1)
            .else(0)
            .end(),
        )
        .as("following"),
      eb.fn
        .sum(
          eb
            .case()
            .when("follows.following_id", "=", post.actor_id)
            .then(1)
            .else(0)
            .end(),
        )
        .as("followers"),
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
        bio={post.bio}
        location={post.location}
        website={post.website}
        avatar_data={post.avatar_data}
        header_data={post.header_data}
        post={post}
      />
    </Layout>,
  );
});

// Login page
app.get("/login", async (c) => {
  const error = c.req.query("error");
  return c.html(
    <Layout>
      <LoginForm error={error} />
    </Layout>,
  );
});

// Login handler
app.post("/login", async (c) => {
  const form = await c.req.formData();
  const username = form.get("username");
  const password = form.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return c.redirect("/login?error=invalid_input");
  }

  // Find user
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.redirect("/login?error=invalid_credentials");
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    return c.redirect("/login?error=invalid_credentials");
  }

  // Generate JWT token and set cookie
  const token = await generateToken(user.id, user.username);
  setAuthCookie(c, token);

  return c.redirect("/");
});

// Registration page
app.get("/register", async (c) => {
  return c.html(
    <Layout>
      <RegisterForm />
    </Layout>,
  );
});

// Registration handler
app.post("/register", async (c) => {
  const form = await c.req.formData();
  const username = form.get("username");
  const name = form.get("name");
  const password = form.get("password");
  const confirmPassword = form.get("confirmPassword");

  // Validate input
  if (typeof username !== "string" || !username.match(/^[a-z0-9_-]{1,50}$/)) {
    return c.redirect("/register");
  }
  if (typeof name !== "string" || name.trim() === "") {
    return c.redirect("/register");
  }
  if (typeof password !== "string" || password.length < 8) {
    return c.redirect("/register");
  }
  if (password !== confirmPassword) {
    return c.redirect("/register");
  }

  // Check if username already exists
  const existingUser = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (existingUser) {
    return c.redirect("/register");
  }

  const passwordHash = await hashPassword(password);
  const url = new URL(c.req.url);
  const handle = `@${username}@${url.host}`;
  const ctx = fedi.createContext(c.req.raw, undefined);

  try {
    await db.transaction().execute(async (trx) => {
      // Check if this is the first user by checking if user with id = 0 exists
      const userWithIdZero = await trx
        .selectFrom("users")
        .select(["id"])
        .where("id", "=", 0)
        .executeTakeFirst();

      const isFirstUser = !userWithIdZero;

      // Create user with ID 0 for first user
      let insertedUser: User | undefined;
      if (isFirstUser) {
        // For the first user, explicitly set ID to 0
        await trx
          .insertInto("users")
          .values({ id: 0, username, password_hash: passwordHash })
          .execute();

        insertedUser = await trx
          .selectFrom("users")
          .selectAll()
          .where("id", "=", 0)
          .executeTakeFirst();
      } else {
        // For subsequent users, let the database auto-assign ID
        insertedUser = await trx
          .insertInto("users")
          .values({ username, password_hash: passwordHash })
          .returningAll()
          .executeTakeFirst();
      }

      if (!insertedUser) {
        throw new Error("Failed to create user");
      }

      // Create actor
      await trx
        .insertInto("actors")
        .values({
          user_id: insertedUser.id,
          uri: ctx.getActorUri(username).href,
          handle,
          name,
          inbox_url: ctx.getInboxUri(username).href,
          shared_inbox_url: ctx.getInboxUri().href,
          url: ctx.getActorUri(username).href,
        })
        .execute();
    });

    // Registration successful, auto-login
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("username", "=", username)
      .executeTakeFirst();

    if (user) {
      const token = await generateToken(user.id, user.username);
      setAuthCookie(c, token);
    }

    return c.redirect("/");
  } catch (error) {
    logger.error("Registration error: {error}", { error });
    return c.redirect("/register");
  }
});

// Profile edit page
app.get("/users/:username/edit", authMiddleware, async (c) => {
  const username = c.req.param("username");
  const authUser = c.get("user");

  // Only allow users to edit their own profile
  if (authUser?.username !== username) {
    return c.redirect(`/users/${username}`);
  }

  const user = await db
    .selectFrom("users")
    .innerJoin("actors", "users.id", "actors.user_id")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst();

  if (user == null) return c.notFound();

  return c.html(
    <Layout>
      <ProfileEditForm user={user} />
    </Layout>,
  );
});

// Profile update handler
app.post("/users/:username/profile", authMiddleware, async (c) => {
  const username = c.req.param("username");
  const authUser = c.get("user");

  // Only allow users to update their own profile
  if (authUser?.username !== username) {
    return c.redirect(`/users/${username}`);
  }

  const user = await db
    .selectFrom("users")
    .innerJoin("actors", "users.id", "actors.user_id")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst();

  if (user == null) return c.notFound();

  const form = await c.req.formData();
  const name = form.get("name")?.toString() || null;
  const bio = form.get("bio")?.toString() || null;
  const location = form.get("location")?.toString() || null;
  const website = form.get("website")?.toString() || null;
  const avatarFile = form.get("avatar") as File | null;
  const headerFile = form.get("header") as File | null;

  // Validate input
  if (name && name.length > 100) {
    return c.html(
      <Layout>
        <MessagePage
          title="Display Name Too Long"
          message="Display name cannot exceed 100 characters. Please shorten it and try again."
          type="error"
          backUrl={`/users/${username}/edit`}
          backText="Back to Edit"
        />
      </Layout>,
    );
  }
  if (bio && bio.length > 500) {
    return c.html(
      <Layout>
        <MessagePage
          title="Bio Too Long"
          message="Bio cannot exceed 500 characters. Please shorten it and try again."
          type="error"
          backUrl={`/users/${username}/edit`}
          backText="Back to Edit"
        />
      </Layout>,
    );
  }
  if (location && location.length > 100) {
    return c.html(
      <Layout>
        <MessagePage
          title="Location Too Long"
          message="Location cannot exceed 100 characters. Please shorten it and try again."
          type="error"
          backUrl={`/users/${username}/edit`}
          backText="Back to Edit"
        />
      </Layout>,
    );
  }
  if (website && !website.match(/^https?:\/\/.+/)) {
    return c.html(
      <Layout>
        <MessagePage
          title="Invalid Website URL"
          message="Please enter a valid website URL that starts with http:// or https://."
          type="error"
          backUrl={`/users/${username}/edit`}
          backText="Back to Edit"
        />
      </Layout>,
    );
  }

  // Handle image uploads
  let avatar_data = user.avatar_data;
  let header_data = user.header_data;

  if (avatarFile && avatarFile.size > 0) {
    if (avatarFile.size > 2 * 1024 * 1024) {
      // 2MB limit
      return c.html(
        <Layout>
          <MessagePage
            title="Avatar File Too Large"
            message="Avatar file size cannot exceed 2MB. Please choose a smaller image file."
            type="error"
            backUrl={`/users/${username}/edit`}
            backText="Back to Edit"
          />
        </Layout>,
      );
    }
    if (!avatarFile.type.startsWith("image/")) {
      return c.html(
        <Layout>
          <MessagePage
            title="Invalid Avatar File Format"
            message="Avatar must be an image file. Please choose jpg, png or other image formats."
            type="error"
            backUrl={`/users/${username}/edit`}
            backText="Back to Edit"
          />
        </Layout>,
      );
    }
    const buffer = await avatarFile.arrayBuffer();
    const base64 = encodeBase64(buffer);
    avatar_data = `data:${avatarFile.type};base64,${base64}`;
  }

  if (headerFile && headerFile.size > 0) {
    if (headerFile.size > 5 * 1024 * 1024) {
      // 5MB limit
      return c.html(
        <Layout>
          <MessagePage
            title="Header Image File Too Large"
            message="Header image file size cannot exceed 5MB. Please choose a smaller image file."
            type="error"
            backUrl={`/users/${username}/edit`}
            backText="Back to Edit"
          />
        </Layout>,
      );
    }
    if (!headerFile.type.startsWith("image/")) {
      return c.html(
        <Layout>
          <MessagePage
            title="Invalid Header Image File Format"
            message="Header image must be an image file. Please choose jpg, png or other image formats."
            type="error"
            backUrl={`/users/${username}/edit`}
            backText="Back to Edit"
          />
        </Layout>,
      );
    }
    const buffer = await headerFile.arrayBuffer();
    const base64 = encodeBase64(buffer);
    header_data = `data:${headerFile.type};base64,${base64}`;
  }

  // Update database
  await db
    .updateTable("actors")
    .set({
      name: name || null,
      bio: bio || null,
      location: location || null,
      website: website || null,
      avatar_data,
      header_data,
      updated: Temporal.Now.instant().toString(),
    })
    .where("user_id", "=", user.id)
    .execute();

  // Broadcast ActivityPub Update activity to followers
  try {
    const ctx = fedi.createContext(c.req.raw, undefined);
    const personUri = ctx.getActorUri(username);
    const person = await ctx.getActor(username);

    if (person) {
      const updateActivity = new Update({
        id: new URL(`#update-${Date.now()}`, personUri),
        actor: personUri,
        object: person,
        to: PUBLIC_COLLECTION,
        cc: ctx.getFollowersUri(username),
        published: Temporal.Now.instant(),
      });

      await ctx.sendActivity(
        { identifier: username },
        "followers",
        updateActivity,
      );
    }
  } catch (error) {
    logger.error("Failed to broadcast person update: {error}", { error });
    // Don't block user operation, just log the error
  }

  return c.redirect(`/users/${username}`);
});

// Notification related routes

// Get notification list (with pagination support)
app.get("/notifications", authMiddleware, async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.redirect("/login");
  }

  // Get pagination parameters
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = 20; // Display 20 notifications per page
  const offset = (page - 1) * limit;

  // Get user's actor information
  const actor = await db
    .selectFrom("actors")
    .select(["id"])
    .where("user_id", "=", authUser.userId)
    .executeTakeFirst();

  if (!actor) {
    return c.notFound();
  }

  // Get total notification count
  const totalResult = await db
    .selectFrom("notifications")
    .select((eb) => eb.fn.count("id").as("total"))
    .where("recipient_actor_id", "=", actor.id)
    .executeTakeFirst();

  const total = Number(totalResult?.total ?? 0);
  const totalPages = Math.ceil(total / limit);

  // Get notification list, including related posts and user information
  const notifications = await db
    .selectFrom("notifications")
    .leftJoin("posts", "notifications.related_post_id", "posts.id")
    .leftJoin(
      "actors as related_actors",
      "notifications.related_actor_id",
      "related_actors.id",
    )
    .selectAll("notifications")
    .select([
      "posts.content as post_content",
      "posts.uri as post_uri",
      "related_actors.name as related_actor_name",
      "related_actors.handle as related_actor_handle",
      "related_actors.avatar_data as related_actor_avatar",
    ])
    .where("notifications.recipient_actor_id", "=", actor.id)
    .orderBy("notifications.created", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return c.html(
    <Layout>
      <NotificationPage
        notifications={notifications}
        currentPage={page}
        totalPages={totalPages}
        total={total}
      />
    </Layout>,
  );
});

// Mark single notification as read
app.post("/notifications/:id/read", authMiddleware, async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.redirect("/login");
  }

  const notificationId = Number(c.req.param("id"));
  if (Number.isNaN(notificationId)) {
    return c.redirect("/notifications");
  }

  // Get user's actor information
  const actor = await db
    .selectFrom("actors")
    .select(["id"])
    .where("user_id", "=", authUser.userId)
    .executeTakeFirst();

  if (!actor) {
    return c.redirect("/notifications");
  }

  // Mark notification as read (can only mark notifications belonging to current user)
  await db
    .updateTable("notifications")
    .set({ is_read: 1 })
    .where("id", "=", notificationId)
    .where("recipient_actor_id", "=", actor.id)
    .execute();

  return c.redirect("/notifications");
});

// Mark all notifications as read
app.post("/notifications/mark-all-read", authMiddleware, async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.redirect("/login");
  }

  // Get user's actor information
  const actor = await db
    .selectFrom("actors")
    .select(["id"])
    .where("user_id", "=", authUser.userId)
    .executeTakeFirst();

  if (!actor) {
    return c.redirect("/notifications");
  }

  // Mark all user's notifications as read
  await db
    .updateTable("notifications")
    .set({ is_read: 1 })
    .where("recipient_actor_id", "=", actor.id)
    .where("is_read", "=", 0)
    .execute();

  return c.redirect("/notifications");
});

// Delete single notification
app.post("/notifications/:id/delete", authMiddleware, async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.redirect("/login");
  }

  const notificationId = Number(c.req.param("id"));
  if (Number.isNaN(notificationId)) {
    return c.redirect("/notifications");
  }

  // Get user's actor information
  const actor = await db
    .selectFrom("actors")
    .select(["id"])
    .where("user_id", "=", authUser.userId)
    .executeTakeFirst();

  if (!actor) {
    return c.redirect("/notifications");
  }

  // Delete notification (can only delete notifications belonging to current user)
  await db
    .deleteFrom("notifications")
    .where("id", "=", notificationId)
    .where("recipient_actor_id", "=", actor.id)
    .execute();

  return c.redirect("/notifications");
});

// Clear all notifications
app.post("/notifications/clear", authMiddleware, async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.redirect("/login");
  }

  // Get user's actor information
  const actor = await db
    .selectFrom("actors")
    .select(["id"])
    .where("user_id", "=", authUser.userId)
    .executeTakeFirst();

  if (!actor) {
    return c.redirect("/notifications");
  }

  // Delete all user's notifications
  await db
    .deleteFrom("notifications")
    .where("recipient_actor_id", "=", actor.id)
    .execute();

  return c.redirect("/notifications");
});

// Logout
app.post("/logout", async (c) => {
  clearAuthCookie(c);
  return c.redirect("/login");
});

export default app;
