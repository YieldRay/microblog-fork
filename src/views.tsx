/** @jsxImportSource hono/jsx */
import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import {
  Avatar,
  Button,
  Card,
  Container,
  Flex,
  FormField,
  HeaderImage,
  Input,
  LinkButton,
  NotificationBadge as NotificationBadgeComponent,
  PageMessage,
  Textarea,
} from "./components.tsx";
import type { Actor, Notification, Post, User } from "./database.ts";
import { highlightMentions } from "./mentions.ts";
import { escapeHtml, sanitizeActivityPubContent } from "./security.ts";
import {
  formatForDateTimeAttribute,
  formatForDisplay,
  formatRelativeTime,
} from "./time.ts";

export type PageHeaderProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  showHomeButton?: boolean;
  backUrl?: string;
  backText?: string;
}>;

export const PageHeader: FC<PageHeaderProps> = ({
  title,
  subtitle,
  showHomeButton = true,
  backUrl,
  backText = "Back",
  children,
}) => (
  <Flex justify="between" align="center" className="mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 mb-1">{title}</h1>
      {subtitle && <p class="text-slate-600">{subtitle}</p>}
    </div>
    <Flex gap="3" align="center">
      {children}
      {backUrl && (
        <LinkButton href={backUrl} variant="outline" size="sm">
          ← {backText}
        </LinkButton>
      )}
      {showHomeButton && (
        <LinkButton href="/" variant="secondary" size="sm">
          🏠 Home
        </LinkButton>
      )}
    </Flex>
  </Flex>
);

export const Layout: FC = (props) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <title>Microblog</title>
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>
        {raw /* css */`.microblog-article a {
          &:hover {
            text-decoration: underline;
          }
        }`}
      </style>
    </head>
    <body class="bg-slate-50 min-h-screen">
      <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {props.children}
      </main>
    </body>
  </html>
);

export interface HomeProps extends PostListProps {
  user: User & Actor;
  unreadNotificationCount?: number;
}

export const Home: FC<HomeProps> = ({
  user,
  posts,
  unreadNotificationCount = 0,
}) => (
  <>
    <Flex justify="between" align="center" className="mb-8">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 mb-2">
          {escapeHtml(user.name || user.username)}'s microblog
        </h1>
        <p class="text-slate-600">
          <a
            href={`/users/${escapeHtml(user.username)}`}
            class="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {escapeHtml(user.name || user.username)}'s profile
          </a>
        </p>
      </div>
      <Flex align="center" gap="4">
        <a href="/notifications" class="no-underline">
          <NotificationBadge count={unreadNotificationCount} />
        </a>
        <form method="post" action="/logout">
          <Button type="submit" variant="secondary" size="sm">
            Logout
          </Button>
        </form>
      </Flex>
    </Flex>

    <Card className="mb-8 clear-both">
      <form
        method="post"
        action={`/users/${escapeHtml(user.username)}/posts`}
        class="space-y-4"
      >
        <FormField>
          <Textarea
            name="content"
            required={true}
            placeholder="What's up?"
            rows={4}
            className="min-h-16"
          />
        </FormField>
        <Flex justify="end" align="center" gap="3">
          <Button type="submit" variant="primary" className="px-8">
            Post
          </Button>
        </Flex>
      </form>
    </Card>

    <PostList posts={posts} />
  </>
);

export const LoginForm: FC = () => {
  return (
    <Container maxWidth="sm">
      <Card className="mt-8">
        <h1 class="text-2xl font-bold text-slate-900 text-center mb-6">
          Login to your microblog
        </h1>

        <form method="post" action="/login" class="space-y-6">
          <FormField label="Username" required>
            <Input type="text" name="username" required maxlength={50} />
          </FormField>

          <FormField label="Password" required>
            <Input type="password" name="password" required />
          </FormField>

          <Button type="submit" variant="primary" className="w-full">
            Login
          </Button>
        </form>

        <p class="mt-6 text-center text-slate-600">
          Don't have an account?{" "}
          <a
            href="/register"
            class="text-blue-600 hover:text-blue-800 hover:underline"
          >
            Register here
          </a>
        </p>
      </Card>
    </Container>
  );
};

export const RegisterForm: FC = () => (
  <Container maxWidth="sm">
    <Card className="mt-8">
      <h1 class="text-2xl font-bold text-slate-900 text-center mb-6">
        Register for a microblog
      </h1>

      <form method="post" action="/register" class="space-y-6">
        <FormField label="Username" required>
          <Input
            type="text"
            name="username"
            required
            maxlength={50}
            pattern="^[a-z0-9_\-]+$"
            placeholder="lowercase letters, numbers, _ and - only"
          />
        </FormField>

        <FormField label="Display Name" required>
          <Input
            type="text"
            name="name"
            required
            placeholder="Your display name"
          />
        </FormField>

        <FormField label="Password" required>
          <Input
            type="password"
            name="password"
            required
            minlength={6}
            placeholder="At least 6 characters"
          />
        </FormField>

        <FormField label="Confirm Password" required>
          <Input
            type="password"
            name="confirmPassword"
            required
            minlength={6}
            placeholder="Confirm your password"
          />
        </FormField>

        <Button type="submit" variant="primary" className="w-full">
          Register
        </Button>
      </form>

      <p class="mt-6 text-center text-slate-600">
        Already have an account?{" "}
        <a
          href="/login"
          class="text-blue-600 hover:text-blue-800 hover:underline"
        >
          Login here
        </a>
      </p>
    </Card>
  </Container>
);

export interface ProfileEditFormProps {
  user: User & Actor;
}

export const ProfileEditForm: FC<ProfileEditFormProps> = ({ user }) => (
  <>
    <Card className="mt-8">
      <PageHeader
        title="Edit Profile"
        backUrl={`/users/${user.username}`}
        backText="Back to Profile"
      />

      <form
        method="post"
        action={`/users/${escapeHtml(user.username)}/profile`}
        enctype="multipart/form-data"
        class="space-y-6"
      >
        <FormField label="Display Name">
          <Input
            type="text"
            name="name"
            value={user.name || ""}
            maxlength={100}
            placeholder="Your display name"
          />
        </FormField>

        <FormField label="Bio">
          <Textarea
            name="bio"
            placeholder="Tell us about yourself..."
            maxlength={500}
            rows={4}
            value={user.bio || ""}
          />
        </FormField>

        <FormField label="Location">
          <Input
            type="text"
            name="location"
            value={user.location || ""}
            placeholder="Where are you located?"
            maxlength={100}
          />
        </FormField>

        <FormField label="Website">
          <Input
            type="url"
            name="website"
            value={user.website || ""}
            placeholder="https://example.com"
          />
        </FormField>

        <FormField label="Avatar">
          <Input type="file" name="avatar" accept="image/*" />
          {user.avatar_data && (
            <div class="mt-3">
              <p class="text-sm text-slate-600 mb-2">Current avatar:</p>
              <Avatar src={user.avatar_data} alt="Current avatar" size="lg" />
            </div>
          )}
        </FormField>

        <FormField label="Header Image">
          <Input type="file" name="header" accept="image/*" />
          {user.header_data && (
            <div class="mt-3">
              <p class="text-sm text-slate-600 mb-2">Current header:</p>
              <img
                src={user.header_data}
                alt="Current header"
                class="w-48 h-24 rounded-lg object-cover border border-slate-200"
              />
            </div>
          )}
        </FormField>

        <Flex gap="4" className="pt-4">
          <Button type="submit" variant="primary">
            Save Changes
          </Button>
          <LinkButton
            href={`/users/${escapeHtml(user.username)}`}
            variant="secondary"
          >
            Cancel
          </LinkButton>
        </Flex>
      </form>
    </Card>
  </>
);

export interface ProfileCardProps {
  name: string;
  username: string;
  handle: string;
  following: number;
  followers: number;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  avatar_data?: string | null;
  header_data?: string | null;
  isOwnProfile?: boolean;
}

export const ProfileCard: FC<ProfileCardProps> = ({
  name,
  username,
  handle,
  following,
  followers,
  bio,
  location,
  website,
  avatar_data,
  header_data,
  isOwnProfile = false,
}) => (
  <>
    {header_data && (
      <div class="mb-6">
        <HeaderImage src={header_data} alt="Profile header" />
      </div>
    )}

    <Card className="mb-6">
      <Flex align="start" gap="4" className="mb-4">
        <Avatar src={avatar_data || undefined} alt="Avatar" size="xl" />
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-slate-900 mb-1">
            <a
              href={`/users/${escapeHtml(username)}`}
              class="text-slate-900 hover:text-blue-600 no-underline"
            >
              {escapeHtml(name)}
            </a>
          </h1>
          <p class="text-slate-600 mb-2">
            <span class="select-all font-mono text-sm">{handle}</span>
            {isOwnProfile && (
              <>
                <span class="mx-2">•</span>
                <a
                  href={`/users/${username}/edit`}
                  class="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Edit Profile
                </a>
              </>
            )}
          </p>
        </div>
      </Flex>

      {bio && (
        <p class="text-slate-700 mb-4 whitespace-pre-wrap">{escapeHtml(bio)}</p>
      )}

      <Flex gap="6" wrap className="mb-4 text-sm text-slate-600">
        {location && (
          <span class="flex items-center gap-1">
            <span>📍</span>
            {escapeHtml(location)}
          </span>
        )}
        {website && (
          <span class="flex items-center gap-1">
            <span>🔗</span>
            <a
              href={escapeHtml(website)}
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {escapeHtml(website)}
            </a>
          </span>
        )}
      </Flex>

      <Flex gap="6" className="text-sm">
        <a
          href={`/users/${username}/following`}
          class="text-slate-700 hover:text-blue-600 hover:underline"
        >
          <span class="font-semibold text-slate-900">{following}</span>{" "}
          following
        </a>
        <a
          href={`/users/${username}/followers`}
          class="text-slate-700 hover:text-blue-600 hover:underline"
        >
          <span class="font-semibold text-slate-900">{followers}</span>{" "}
          {followers === 1 ? "follower" : "followers"}
        </a>
      </Flex>
    </Card>
  </>
);

export interface ProfileProps extends ProfileCardProps {}

export const Profile: FC<ProfileProps> = (props) => (
  <>
    <PageHeader title="Profile" backUrl="/" backText="Back to Home" />
    <ProfileCard {...props} />
  </>
);

export interface FollowingListProps {
  following: Actor[];
  username?: string;
  isOwnProfile?: boolean;
}

export const FollowingList: FC<FollowingListProps> = ({
  following,
  username,
  isOwnProfile = false,
}) => (
  <>
    <PageHeader
      title="Following"
      backUrl={username ? `/users/${username}` : "/"}
      backText="Back to Profile"
    />
    {isOwnProfile && username && (
      <Card className="mb-6">
        <form
          method="post"
          action={`/users/${escapeHtml(username)}/following`}
          class="space-y-4"
        >
          <FormField label="Follow someone">
            <Flex gap="2">
              <Input
                type="text"
                name="actor"
                required={true}
                placeholder="Enter an actor handle (e.g., @johndoe@mastodon.com) or URI"
                className="flex-1"
              />
              <Button type="submit" variant="primary">
                Follow
              </Button>
            </Flex>
          </FormField>
        </form>
      </Card>
    )}
    <Card>
      {following.length === 0 ? (
        <div class="text-center py-8 text-slate-500">
          <p class="text-lg mb-2">👥</p>
          <p>Not following anyone yet</p>
        </div>
      ) : (
        <div class="space-y-4">
          {following.map((actor) => (
            <div key={actor.id} class="flex items-center justify-between py-2">
              <div class="flex items-center gap-3">
                <Avatar
                  src={actor.avatar_data || undefined}
                  alt="Avatar"
                  size="sm"
                />
                <ActorLink actor={actor} />
              </div>
              {isOwnProfile && username && (
                <form
                  method="post"
                  action={`/users/${escapeHtml(username)}/unfollow`}
                >
                  <input type="hidden" name="actorId" value={actor.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      confirm("Are you sure you want to unfollow this user?")
                    }
                  >
                    Unfollow
                  </Button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  </>
);

export interface FollowerListProps {
  followers: Actor[];
  username?: string;
}

export const FollowerList: FC<FollowerListProps> = ({
  followers,
  username,
}) => (
  <>
    <PageHeader
      title="Followers"
      backUrl={username ? `/users/${username}` : "/"}
      backText="Back to Profile"
    />
    <Card>
      {followers.length === 0 ? (
        <div class="text-center py-8 text-slate-500">
          <p class="text-lg mb-2">👥</p>
          <p>No followers yet</p>
        </div>
      ) : (
        <div class="space-y-4">
          {followers.map((follower) => (
            <div key={follower.id} class="flex items-center gap-3 py-2">
              <Avatar
                src={follower.avatar_data || undefined}
                alt="Avatar"
                size="sm"
              />
              <ActorLink actor={follower} />
            </div>
          ))}
        </div>
      )}
    </Card>
  </>
);

export interface ActorLinkProps {
  actor: Actor;
}

export const ActorLink: FC<ActorLinkProps> = ({ actor }) => {
  const href = actor.url ?? actor.uri;
  return actor.name == null ? (
    <a href={href} class="text-slate-600 hover:text-blue-600 hover:underline">
      {escapeHtml(actor.handle)}
    </a>
  ) : (
    <span class="inline-flex items-center gap-1">
      <a
        href={href}
        class="font-medium text-slate-900 hover:text-blue-600 hover:underline"
      >
        {escapeHtml(actor.name || "")}
      </a>
      <span class="text-sm text-slate-500">
        (
        <a
          href={href}
          class="text-slate-500 hover:text-blue-600 hover:underline"
        >
          {escapeHtml(actor.handle)}
        </a>
        )
      </span>
    </span>
  );
};

export interface PostActorLinkProps {
  actor: Actor;
}

export const PostActorLink: FC<PostActorLinkProps> = ({ actor }) => {
  return actor.name == null ? (
    <span class="text-slate-600">{escapeHtml(actor.handle)}</span>
  ) : (
    <span class="inline-flex items-center gap-1">
      <span class="font-medium text-slate-900">
        {escapeHtml(actor.name || "")}
      </span>
      <span class="text-sm text-slate-500">({escapeHtml(actor.handle)})</span>
    </span>
  );
};

export interface PostPageProps extends ProfileProps, PostViewProps {}

export const PostPage: FC<PostPageProps> = (props) => (
  <>
    <PageHeader
      title="Post"
      backUrl={`/users/${props.username}`}
      backText="Back to Profile"
    />
    <ProfileCard
      name={props.name}
      username={props.username}
      handle={props.handle}
      following={props.following}
      followers={props.followers}
      bio={props.bio}
      location={props.location}
      website={props.website}
      avatar_data={props.avatar_data}
      header_data={props.header_data}
      isOwnProfile={props.isOwnProfile}
    />
    <PostView post={props.post} />
  </>
);

export interface PostViewProps {
  post: Post & Actor;
}

export const PostView: FC<PostViewProps> = ({ post }) => {
  // Process content as HTML - highlight mentions first, then sanitize
  const contentWithMentions = highlightMentions(post.content);
  const processedContent = sanitizeActivityPubContent(contentWithMentions);

  // get username from handle
  const username = post.handle.split("@")[1];
  // Determine if the post is from an external server
  const isExternal =
    post.url && !post.url.startsWith("/") && !post.url.includes("localhost");
  const postUrl = isExternal ? post.url : `/users/${username}/posts/${post.id}`;

  return (
    <a href={postUrl!}>
      <article class="microblog-article bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors p-4 mb-4 cursor-pointer">
        <Flex align="start" gap="3" className="mb-3">
          <Avatar src={post.avatar_data!} alt="Avatar" size="sm" />
          <div class="flex-1 min-w-0">
            <div class="mb-2">
              <PostActorLink actor={post} />
            </div>
            <div
              class="prose prose-sm max-w-none text-slate-900"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: use with sanitized content
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />
          </div>
        </Flex>
        <div class="text-sm text-slate-500 border-t border-slate-100 pt-3">
          <time datetime={formatForDateTimeAttribute(post.created)}>
            {formatForDisplay(post.created)}
          </time>
        </div>
      </article>
    </a>
  );
};

export interface PostListProps {
  posts: (Post & Actor)[];
}

export const PostList: FC<PostListProps> = ({ posts }) => (
  <div class="space-y-4">
    {posts.length === 0 ? (
      <Card className="text-center py-12">
        <div class="text-slate-500">
          <p class="text-lg mb-2">📝</p>
          <p>No posts yet</p>
        </div>
      </Card>
    ) : (
      posts.map((post) => <PostView key={post.id} post={post} />)
    )}
  </div>
);

// Notification related components

export interface NotificationItemProps {
  notification: Notification & {
    post_content?: string | null;
    post_uri?: string | null;
    related_actor_name?: string | null;
    related_actor_handle?: string | null;
    related_actor_avatar?: string | null;
  };
}

export const NotificationItem: FC<NotificationItemProps> = ({
  notification,
}) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "mention":
        return "💬";
      case "follow":
        return "👤";
      case "like":
        return "❤️";
      case "direct":
        return "✉️";
      default:
        return "📢";
    }
  };

  return (
    <Card
      variant="notification"
      className={`mb-4 ${notification.is_read ? "bg-slate-50" : "bg-white"}`}
    >
      <Flex align="start" gap="3" className="mb-3">
        <Avatar
          src={notification.related_actor_avatar || undefined}
          alt="Avatar"
          size="sm"
        />
        <div class="flex-1 min-w-0">
          <Flex align="center" gap="2" className="mb-2">
            <span class="text-lg">
              {getNotificationIcon(notification.type)}
            </span>
            <span class="font-semibold text-slate-900">
              {escapeHtml(
                notification.related_actor_name ||
                  notification.related_actor_handle ||
                  "Unknown user",
              )}
            </span>
            <span class="text-sm text-slate-500">
              {formatRelativeTime(notification.created)}
            </span>
          </Flex>
          <p class="text-slate-700 mb-3">{escapeHtml(notification.message)}</p>

          {notification.post_content && (
            <div class="bg-slate-50 border-l-4 border-blue-500 p-3 rounded-r-md">
              <div
                class="prose prose-sm max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: use with sanitized content
                dangerouslySetInnerHTML={{
                  __html: sanitizeActivityPubContent(notification.post_content),
                }}
              />
              {notification.post_uri && (
                <div class="mt-2">
                  <a
                    href={notification.post_uri}
                    class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View post
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <Flex align="center" gap="2">
          {!notification.is_read && (
            <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
          )}
          <Flex gap="1">
            {!notification.is_read && (
              <form
                method="post"
                action={`/notifications/${notification.id}/read`}
              >
                <button
                  type="submit"
                  class="text-xs text-blue-600 hover:text-blue-800 hover:underline bg-none border-none cursor-pointer p-1"
                >
                  Mark as read
                </button>
              </form>
            )}
            <form
              method="post"
              action={`/notifications/${notification.id}/delete`}
            >
              <button
                type="submit"
                class="text-xs text-red-600 hover:text-red-800 hover:underline bg-none border-none cursor-pointer p-1"
                onclick="return confirm('Are you sure you want to delete this notification?')"
              >
                Delete
              </button>
            </form>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
};

export interface NotificationListProps {
  notifications: (Notification & {
    post_content?: string | null;
    post_uri?: string | null;
    related_actor_name?: string | null;
    related_actor_handle?: string | null;
    related_actor_avatar?: string | null;
  })[];
}

export const NotificationList: FC<NotificationListProps> = ({
  notifications,
}) => (
  <div class="space-y-4">
    {notifications.length === 0 ? (
      <Card className="text-center py-12">
        <div class="text-slate-500">
          <p class="text-2xl mb-2">📭</p>
          <p class="text-lg">No notifications</p>
        </div>
      </Card>
    ) : (
      notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))
    )}
  </div>
);

export interface NotificationPageProps {
  notifications: (Notification & {
    post_content?: string | null;
    post_uri?: string | null;
    related_actor_name?: string | null;
    related_actor_handle?: string | null;
    related_actor_avatar?: string | null;
  })[];
  currentPage?: number;
  totalPages?: number;
  total?: number;
}

export const NotificationPage: FC<NotificationPageProps> = ({
  notifications,
  currentPage = 1,
  totalPages = 1,
  total = 0,
}) => {
  const hasUnreadNotifications = notifications.some((n) => !n.is_read);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`View your latest notifications ${total > 0 ? `(${total} total)` : ""}`}
      >
        {hasUnreadNotifications && (
          <form method="post" action="/notifications/mark-all-read">
            <Button type="submit" variant="outline">
              Mark all as read
            </Button>
          </form>
        )}
        {notifications.length > 0 && (
          <form method="post" action="/notifications/clear">
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              onClick={() =>
                confirm("Are you sure you want to clear all notifications?")
              }
            >
              Clear all
            </Button>
          </form>
        )}
      </PageHeader>

      <NotificationList notifications={notifications} />

      {totalPages > 1 && (
        <Flex justify="center" align="center" gap="4" className="mt-8">
          {currentPage > 1 && (
            <>
              <LinkButton href="/notifications?page=1" variant="outline">
                First
              </LinkButton>
              <LinkButton
                href={`/notifications?page=${currentPage - 1}`}
                variant="outline"
              >
                Previous
              </LinkButton>
            </>
          )}

          <span class="px-4 text-slate-600">
            Page {currentPage} of {totalPages}
          </span>

          {currentPage < totalPages && (
            <>
              <LinkButton
                href={`/notifications?page=${currentPage + 1}`}
                variant="outline"
              >
                Next
              </LinkButton>
              <LinkButton
                href={`/notifications?page=${totalPages}`}
                variant="outline"
              >
                Last
              </LinkButton>
            </>
          )}
        </Flex>
      )}
    </>
  );
};

export interface NotificationBadgeProps {
  count: number;
}

export const NotificationBadge: FC<NotificationBadgeProps> = ({ count }) => (
  <NotificationBadgeComponent count={count} />
);

// Mention highlight component
export interface MentionHighlightProps {
  content: string;
}

export const MentionHighlight: FC<MentionHighlightProps> = ({ content }) => {
  const highlightedContent = highlightMentions(content);

  return (
    <span
      // biome-ignore lint/security/noDangerouslySetInnerHtml: use with sanitized content
      dangerouslySetInnerHTML={{
        __html: sanitizeActivityPubContent(highlightedContent),
      }}
    />
  );
};

export interface MessagePageProps {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  backUrl?: string;
  backText?: string;
  actions?: Array<{
    text: string;
    href: string;
    variant?: "primary" | "secondary" | "outline";
  }>;
}

export const MessagePage: FC<MessagePageProps> = ({
  title,
  message,
  type = "info",
  backUrl = "/",
  backText = "Back to Home",
  actions = [],
}) => {
  const defaultActions =
    actions.length > 0
      ? actions
      : [{ text: backText, href: backUrl, variant: "primary" as const }];

  return (
    <PageMessage
      title={title}
      message={message}
      type={type}
      actions={defaultActions}
    />
  );
};
