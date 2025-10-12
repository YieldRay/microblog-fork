import type { Actor, NewMention, NewNotification } from "./database.ts";
import db from "./db.ts";
import { escapeHtml } from "./security.ts";

/**
 * Highlight mentions in content with clickable links
 * @param content The content to highlight mentions in
 * @returns Content with highlighted mentions
 */
export function highlightMentions(content: string): string {
  // Regular expression to match @username and @username@domain.com formats
  const mentionRegex =
    /(?:^|[\s\n])(@[a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g;

  return content.replace(mentionRegex, (match, mention) => {
    const username = mention.substring(1); // Remove @ symbol
    const isLocalUser = !username.includes("@");
    const href = isLocalUser ? `/users/${username}` : `#`; // Local user links to user page

    return match.replace(
      mention,
      `<a href="${escapeHtml(href)}" class="mention" style="color: #007bff; text-decoration: none; font-weight: 500; background: rgba(0, 123, 255, 0.1); padding: 2px 4px; border-radius: 3px;">${escapeHtml(mention)}</a>`,
    );
  });
}

/**
 * Parse mentions from post content
 * Supports two formats: @username and @username@domain.com
 * @param content Post content
 * @returns Array of mentioned usernames
 */
export function parseMentions(content: string): string[] {
  // Regular expression to match @username and @username@domain.com formats
  // Ensure @ is preceded by whitespace or string start to avoid matching @ in email addresses
  const mentionRegex =
    /(?:^|[\s\n])@([a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g;

  const mentions: string[] = [];
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional assignment in while condition
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    // Avoid adding duplicate usernames
    if (!mentions.includes(username)) {
      mentions.push(username);
    }
  }

  return mentions;
}

/**
 * Find users (local and remote)
 * @param usernames Array of usernames
 * @returns Array of found Actors
 */
export async function findMentionedUsers(
  usernames: string[],
): Promise<Actor[]> {
  if (usernames.length === 0) {
    return [];
  }

  const foundActors: Actor[] = [];

  for (const username of usernames) {
    try {
      let actor: Actor | undefined;

      if (username.includes("@")) {
        // Remote user format: username@domain.com
        // Find actor with matching handle field
        actor = await db
          .selectFrom("actors")
          .selectAll()
          .where("handle", "=", username)
          .executeTakeFirst();
      } else {
        // Local user format: username
        // First try to find local user through users table username
        const user = await db
          .selectFrom("users")
          .select(["id", "username"])
          .where("username", "=", username)
          .executeTakeFirst();

        if (user) {
          // Found local user, get corresponding actor
          actor = await db
            .selectFrom("actors")
            .selectAll()
            .where("user_id", "=", user.id)
            .executeTakeFirst();
        }

        // If no local user found, try to find remote user with handle as username
        if (!actor) {
          actor = await db
            .selectFrom("actors")
            .selectAll()
            .where("handle", "=", username)
            .executeTakeFirst();
        }
      }

      if (actor) {
        foundActors.push(actor);
      }
    } catch (error) {
      console.error(`Error finding user ${username}:`, error);
      // Continue processing other users, don't interrupt due to single user lookup failure
    }
  }

  return foundActors;
}

/**
 * Save mention records
 * @param postId Post ID
 * @param mentionedActors Array of mentioned users
 */
export async function saveMentions(
  postId: number,
  mentionedActors: Actor[],
): Promise<void> {
  if (mentionedActors.length === 0) {
    return;
  }

  try {
    // Check if mention records already exist to avoid duplicate insertions
    const existingMentions = await db
      .selectFrom("mentions")
      .select(["mentioned_actor_id"])
      .where("post_id", "=", postId)
      .execute();

    const existingActorIds = new Set(
      existingMentions.map((m) => m.mentioned_actor_id),
    );

    // Filter out mention records that need to be added
    const newMentions: NewMention[] = mentionedActors
      .filter((actor) => !existingActorIds.has(actor.id))
      .map((actor) => ({
        post_id: postId,
        mentioned_actor_id: actor.id,
      }));

    if (newMentions.length > 0) {
      await db.insertInto("mentions").values(newMentions).execute();
    }
  } catch (error) {
    console.error("Error saving mention records:", error);
    throw new Error("Failed to save mention records");
  }
}

/**
 * Create mention notifications
 * @param postId Post ID
 * @param authorActorId Post author's actor ID
 * @param mentionedActors Array of mentioned users
 */
export async function createMentionNotifications(
  postId: number,
  authorActorId: number,
  mentionedActors: Actor[],
): Promise<void> {
  if (mentionedActors.length === 0) {
    return;
  }

  try {
    // Get post author information to generate notification message
    const author = await db
      .selectFrom("actors")
      .select(["name", "handle"])
      .where("id", "=", authorActorId)
      .executeTakeFirst();

    if (!author) {
      throw new Error("Cannot find post author information");
    }

    const authorName = author.name || author.handle;

    // Check if same notifications already exist to avoid duplicate creation
    const existingNotifications = await db
      .selectFrom("notifications")
      .select(["recipient_actor_id"])
      .where("type", "=", "mention")
      .where("related_post_id", "=", postId)
      .where("related_actor_id", "=", authorActorId)
      .execute();

    const existingRecipientIds = new Set(
      existingNotifications.map((n) => n.recipient_actor_id),
    );

    // Filter out users who need new notifications (excluding author)
    const newNotifications: NewNotification[] = mentionedActors
      .filter(
        (actor) =>
          actor.id !== authorActorId && !existingRecipientIds.has(actor.id),
      )
      .map((actor) => ({
        recipient_actor_id: actor.id,
        type: "mention" as const,
        related_post_id: postId,
        related_actor_id: authorActorId,
        message: `${authorName} mentioned you in a post`,
        is_read: 0, // SQLite uses integers for boolean values: 0 = false, 1 = true
      }));

    if (newNotifications.length > 0) {
      await db.insertInto("notifications").values(newNotifications).execute();
    }
  } catch (error) {
    console.error("Error creating mention notifications:", error);
    throw new Error("Failed to create mention notifications");
  }
}

/**
 * Process all mentions in a post (main function)
 * @param postId Post ID
 * @param content Post content
 * @param authorActorId Post author's actor ID
 */
export async function processMentions(
  postId: number,
  content: string,
  authorActorId: number,
): Promise<void> {
  try {
    // 1. Parse mentions from post content
    const mentionedUsernames = parseMentions(content);

    if (mentionedUsernames.length === 0) {
      return; // No mentions, return directly
    }

    // 2. Find mentioned users
    const mentionedActors = await findMentionedUsers(mentionedUsernames);

    if (mentionedActors.length === 0) {
      return; // No valid users found, return directly
    }

    // 3. Save mention records
    await saveMentions(postId, mentionedActors);

    // 4. Create mention notifications
    await createMentionNotifications(postId, authorActorId, mentionedActors);

    console.log(
      `Successfully processed mentions for post ${postId}, mentioned ${mentionedActors.length} users`,
    );
  } catch (error) {
    console.error(`Error processing mentions for post ${postId}:`, error);
    throw new Error("Failed to process mentions");
  }
}
