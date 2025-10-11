import {
  Accept,
  Create,
  Endpoints,
  Follow,
  Note,
  PUBLIC_COLLECTION,
  Person,
  Undo,
  Update,
  createFederation,
  exportJwk,
  generateCryptoKeyPair,
  getActorHandle,
  importJwk,
  isActor,
  type Actor as APActor,
  type Recipient,
} from "@fedify/fedify";
import { InProcessMessageQueue, MemoryKvStore } from "@fedify/fedify";
import { Mention } from "@fedify/fedify/vocab";
import { Temporal } from "@js-temporal/polyfill";
import { getLogger } from "@logtape/logtape";
import db from "./db.ts";
import type { Actor, Key } from "./database.ts";
import { findMentionedUsers, parseMentions } from "./mentions.ts";

const logger = getLogger("microblog");

const federation = createFederation({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
});

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const user = await db
      .selectFrom('users')
      .innerJoin('actors', 'users.id', 'actors.user_id')
      .selectAll()
      .where('users.username', '=', identifier)
      .executeTakeFirst();
    if (user == null) return null;

    const keys = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: identifier,
      name: user.name,
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      followers: ctx.getFollowersUri(identifier),
      url: ctx.getActorUri(identifier),
      publicKey: keys[0].cryptographicKey,
      assertionMethods: keys.map((k) => k.multikey),
    });
  })
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', identifier)
      .executeTakeFirst();
    if (user == null) return [];
    const rows = await db
      .selectFrom('keys')
      .selectAll()
      .where('user_id', '=', user.id)
      .execute();
    const keys = Object.fromEntries(
      rows.map((row) => [row.type, row]),
    ) as Record<Key["type"], Key>;
    const pairs: CryptoKeyPair[] = [];
    // Ensure that the user has a key pair for each supported key type
    // (RSASSA-PKCS1-v1_5 and Ed25519); if not, generate one
    // and store it in the database:
    for (const keyType of ["RSASSA-PKCS1-v1_5", "Ed25519"] as const) {
      if (keys[keyType] == null) {
        logger.debug(
          "The user {identifier} does not have an {keyType} key; creating one...",
          { identifier, keyType },
        );
        const { privateKey, publicKey } = await generateCryptoKeyPair(keyType);
        await db
          .insertInto('keys')
          .values({
            user_id: user.id,
            type: keyType,
            private_key: JSON.stringify(await exportJwk(privateKey)),
            public_key: JSON.stringify(await exportJwk(publicKey)),
          })
          .execute();
        pairs.push({ privateKey, publicKey });
      } else {
        pairs.push({
          privateKey: await importJwk(
            JSON.parse(keys[keyType].private_key),
            "private",
          ),
          publicKey: await importJwk(
            JSON.parse(keys[keyType].public_key),
            "public",
          ),
        });
      }
    }
    return pairs;
  });

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.objectId == null) {
      logger.debug("The Follow object does not have an object: {follow}", {
        follow,
      });
      return;
    }
    const object = ctx.parseUri(follow.objectId);
    if (object == null || object.type !== "actor") {
      logger.debug("The Follow object's object is not an actor: {follow}", {
        follow,
      });
      return;
    }
    const follower = await follow.getActor();
    if (follower == null) {
      logger.debug("The Follow object does not have an actor: {follow}", {
        follow,
      });
      return;
    }
    const followingActor = await db
      .selectFrom('actors')
      .innerJoin('users', 'users.id', 'actors.user_id')
      .selectAll()
      .where('users.username', '=', object.identifier)
      .executeTakeFirst();
    const following_id = followingActor?.id;
    if (following_id == null) {
      logger.debug(
        "Failed to find the actor to follow in the database: {object}",
        { object },
      );
    }
    const followerId = (await persistActor(follower))?.id;
    if (following_id != null && followerId != null) {
      await db
        .insertInto('follows')
        .values({
          following_id: following_id,
          follower_id: followerId,
        })
        .execute();
    }
    const accept = new Accept({
      actor: follow.objectId,
      to: follow.actorId,
      object: follow,
    });
    await ctx.sendActivity(object, follower, accept);
  })
  .on(Undo, async (ctx, undo) => {
    const object = await undo.getObject();
    if (!(object instanceof Follow)) return;
    if (undo.actorId == null || object.objectId == null) return;
    const parsed = ctx.parseUri(object.objectId);
    if (parsed == null || parsed.type !== "actor") return;
    if (undo.actorId != null) {
      await db
        .deleteFrom('follows')
        .where((eb) => eb.and([
          eb('following_id', '=', eb
            .selectFrom('actors')
            .innerJoin('users', 'actors.user_id', 'users.id')
            .select('actors.id')
            .where('users.username', '=', parsed.identifier)
          ),
          eb('follower_id', '=', eb
            .selectFrom('actors')
            .select('id')
            .where('uri', '=', undo.actorId!.href)
          )
        ]))
        .execute();
    }
  })
  .on(Accept, async (ctx, accept) => {
    const follow = await accept.getObject();
    if (!(follow instanceof Follow)) return;
    const following = await accept.getActor();
    if (!isActor(following)) return;
    const follower = follow.actorId;
    if (follower == null) return;
    const parsed = ctx.parseUri(follower);
    if (parsed == null || parsed.type !== "actor") return;
    const followingId = (await persistActor(following))?.id;
    if (followingId == null) return;
    const followerActor = await db
      .selectFrom('actors')
      .innerJoin('users', 'actors.user_id', 'users.id')
      .select('actors.id')
      .where('users.username', '=', parsed.identifier)
      .executeTakeFirst();
    
    if (followerActor) {
      await db
        .insertInto('follows')
        .values({
          following_id: followingId,
          follower_id: followerActor.id,
        })
        .execute();
    }
  })
  .on(Create, async (ctx, create) => {
    const object = await create.getObject();
    if (!(object instanceof Note)) return;
    const actor = create.actorId;
    if (actor == null) return;
    const author = await object.getAttribution();
    if (!isActor(author) || author.id?.href !== actor.href) return;
    const actorId = (await persistActor(author))?.id;
    if (actorId == null) return;
    if (object.id == null) return;
    const content = object.content?.toString();
    if (content != null) {
      // Get mediaType, defaults to text/html (ActivityPub standard)
      const mediaType = object.mediaType || 'text/html';
      
      const insertedPost = await db
        .insertInto('posts')
        .values({
          uri: object.id.href,
          actor_id: actorId,
          content: content,
          media_type: mediaType,
          url: object.url instanceof URL ? object.url.href : (typeof object.url === 'string' ? object.url : null),
        })
        .returningAll()
        .executeTakeFirst();

      // Handle attachments
      if (insertedPost) {
      }
    }
  })
  .on(Update, async (ctx, update) => {
    const object = await update.getObject();
    if (!(object instanceof Person)) return;
    
    const actor = update.actorId;
    if (actor == null) return;
    
    // Verify that the updater is the owner of the object being updated
    if (object.id?.href !== actor.href) {
      logger.debug("Update actor does not match object actor: {updateActor} vs {objectActor}", {
        updateActor: actor.href,
        objectActor: object.id?.href
      });
      return;
    }
    
    // Find the corresponding actor
    const existingActor = await db
      .selectFrom('actors')
      .selectAll()
      .where('uri', '=', actor.href)
      .executeTakeFirst();

    if (!existingActor) {
      logger.debug("Actor not found for update: {uri}", { uri: actor.href });
      return;
    }

    // Update actor information
    await db
      .updateTable('actors')
      .set({
        name: object.name?.toString() || null,
        updated: new Date().toISOString(),
      })
      .where('id', '=', existingActor.id)
      .execute();

    logger.info("Updated remote actor from Update activity: {uri}", { uri: actor.href });
  });

federation
  .setFollowersDispatcher(
    "/users/{identifier}/followers",
    async (ctx, identifier, cursor) => {
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
        .where('users.username', '=', identifier)
        .orderBy('follows.created', 'desc')
        .execute();
      const items: Recipient[] = followers.map((f) => ({
        id: new URL(f.uri),
        inboxId: new URL(f.inbox_url),
        endpoints:
          f.shared_inbox_url == null
            ? null
            : { sharedInbox: new URL(f.shared_inbox_url) },
      }));
      return { items };
    },
  )
  .setCounter(async (ctx, identifier) => {
    const result = await db
      .selectFrom('follows')
      .innerJoin('actors', 'actors.id', 'follows.following_id')
      .innerJoin('users', 'users.id', 'actors.user_id')
      .select((eb) => eb.fn.count('follows.follower_id').as('cnt'))
      .where('users.username', '=', identifier)
      .executeTakeFirst();
    return result == null ? 0 : Number(result.cnt);
  });

federation.setObjectDispatcher(
  Note,
  "/users/{identifier}/posts/{id}",
  async (ctx, values) => {
    const post = await db
      .selectFrom('posts')
      .innerJoin('actors', 'actors.id', 'posts.actor_id')
      .innerJoin('users', 'users.id', 'actors.user_id')
      .selectAll('posts')
      .where('users.username', '=', values.identifier)
      .where('posts.id', '=', Number(values.id))
      .executeTakeFirst();
    if (post == null) return null;


    // Parse mentions and create tags field
    const mentionedUsernames = parseMentions(post.content);
    const mentionedActors = await findMentionedUsers(mentionedUsernames);
    
    const tags = mentionedActors.map(actor => {
      // Create ActivityPub-compliant Mention objects
      return new Mention({
        href: new URL(actor.uri),
        name: actor.handle.startsWith('@') ? actor.handle : `@${actor.handle}`,
      });
    });

    return new Note({
      id: ctx.getObjectUri(Note, values),
      attribution: ctx.getActorUri(values.identifier),
      to: PUBLIC_COLLECTION,
      cc: ctx.getFollowersUri(values.identifier),
      content: post.content,
      mediaType: post.media_type || "text/html",
      published: Temporal.Instant.from(`${post.created.replace(" ", "T")}Z`),
      url: ctx.getObjectUri(Note, values),
      tags: tags.length > 0 ? tags : undefined,
    });
  },
);

async function persistActor(actor: APActor): Promise<Actor | null> {
  if (actor.id == null || actor.inboxId == null) {
    logger.debug("Actor is missing required fields: {actor}", { actor });
    return null;
  }
  return await db
    .insertInto('actors')
    .values({
      uri: actor.id.href,
      handle: await getActorHandle(actor),
      name: actor.name?.toString() ?? null,
      inbox_url: actor.inboxId.href,
      shared_inbox_url: actor.endpoints?.sharedInbox?.href ?? null,
      url: actor.url instanceof URL ? actor.url.href : (typeof actor.url === 'string' ? actor.url : null),
    })
    .onConflict((oc) => oc
      .column('uri')
      .doUpdateSet({
        handle: (eb) => eb.ref('excluded.handle'),
        name: (eb) => eb.ref('excluded.name'),
        inbox_url: (eb) => eb.ref('excluded.inbox_url'),
        shared_inbox_url: (eb) => eb.ref('excluded.shared_inbox_url'),
        url: (eb) => eb.ref('excluded.url'),
      })
    )
    .returningAll()
    .executeTakeFirst() ?? null;
}

export default federation;
