import type { FC } from "hono/jsx";
import type { Actor, Post, User, Notification } from "./database.ts";
import { sanitizeActivityPubContent, escapeHtml, processContentByMediaType } from "./security.ts";
import { Temporal } from "@js-temporal/polyfill";
import { highlightMentions } from "./mentions.ts";

export const Layout: FC = (props) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <title>Microblog</title>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
      />
    </head>
    <body>
      <main class="container">{props.children}</main>
    </body>
  </html>
);

export interface HomeProps extends PostListProps {
  user: User & Actor;
  unreadNotificationCount?: number;
}

export const Home: FC<HomeProps> = ({ user, posts, unreadNotificationCount = 0 }) => (
  <>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <hgroup style="margin: 0;">
        <h1>{escapeHtml(user.name || user.username)}'s microblog</h1>
        <p>
          <a href={`/users/${escapeHtml(user.username)}`}>{escapeHtml(user.name || user.username)}'s profile</a>
        </p>
      </hgroup>
      <div style="display: flex; align-items: center; gap: 15px;">
        <a href="/notifications" style="text-decoration: none;">
          <NotificationBadge count={unreadNotificationCount} />
        </a>
        <form method="post" action="/logout" style="margin: 0;">
          <button type="submit" class="secondary" style="padding: 0.5rem 1rem;">Logout</button>
        </form>
      </div>
    </div>
    <form method="post" action={`/users/${escapeHtml(user.username)}/posts`}>
      <fieldset>
        <label>
          <textarea name="content" required={true} placeholder="What's up?" />
        </label>
      </fieldset>
      <input type="submit" value="Post" />
    </form>
    <PostList posts={posts} />
  </>
);


export const LoginForm: FC<{ error?: string }> = ({ error }) => {
  const getErrorMessage = (errorCode?: string) => {
    switch (errorCode) {
      case 'invalid_input':
        return 'Please provide both username and password.';
      case 'invalid_credentials':
        return 'Invalid username or password. Please try again.';
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);

  return (
    <>
      <h1>Login to your microblog</h1>
      {errorMessage && (
        <div style={{ 
          backgroundColor: '#fee', 
          border: '1px solid #fcc', 
          borderRadius: '4px', 
          padding: '10px', 
          marginBottom: '20px',
          color: '#c33'
        }}>
          {errorMessage}
        </div>
      )}
      <form method="post" action="/login">
        <fieldset>
          <label>
            Username{" "}
            <input
              type="text"
              name="username"
              required
              maxlength={50}
            />
          </label>
          <label>
            Password{" "}
            <input
              type="password"
              name="password"
              required
            />
          </label>
        </fieldset>
        <input type="submit" value="Login" />
      </form>
      <p>
        Don't have an account? <a href="/register">Register here</a>
      </p>
    </>
  );
};

export const RegisterForm: FC = () => (
  <>
    <h1>Register for a microblog</h1>
    <form method="post" action="/register">
      <fieldset>
        <label>
          Username{" "}
          <input
            type="text"
            name="username"
            required
            maxlength={50}
            pattern="^[a-z0-9_\-]+$"
          />
        </label>
        <label>
          Name <input type="text" name="name" required />
        </label>
        <label>
          Password{" "}
          <input
            type="password"
            name="password"
            required
            minlength={8}
          />
        </label>
        <label>
          Confirm Password{" "}
          <input
            type="password"
            name="confirmPassword"
            required
            minlength={8}
          />
        </label>
      </fieldset>
      <input type="submit" value="Register" />
    </form>
    <p>
      Already have an account? <a href="/login">Login here</a>
    </p>
  </>
);

export interface ProfileEditFormProps {
  user: User & Actor;
}

export const ProfileEditForm: FC<ProfileEditFormProps> = ({ user }) => (
  <>
    <h1>Edit Profile</h1>
    <form method="post" action={`/users/${escapeHtml(user.username)}/profile`} enctype="multipart/form-data">
      <fieldset>
        <label>
          Display Name
          <input
            type="text"
            name="name"
            value={user.name || ''}
            maxlength={100}
          />
        </label>
        <label>
          Bio
          <textarea
            name="bio"
            placeholder="Tell us about yourself..."
            maxlength={500}
            rows={4}
          >{user.bio || ''}</textarea>
        </label>
        <label>
          Location
          <input
            type="text"
            name="location"
            value={user.location || ''}
            placeholder="Where are you located?"
            maxlength={100}
          />
        </label>
        <label>
          Website
          <input
            type="url"
            name="website"
            value={user.website || ''}
            placeholder="https://example.com"
          />
        </label>
        <label>
          Avatar
          <input
            type="file"
            name="avatar"
            accept="image/*"
          />
          {user.avatar_data && (
            <div style="margin-top: 10px;">
              <img src={user.avatar_data} alt="Current avatar" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;" />
            </div>
          )}
        </label>
        <label>
          Header Image
          <input
            type="file"
            name="header"
            accept="image/*"
          />
          {user.header_data && (
            <div style="margin-top: 10px;">
              <img src={user.header_data} alt="Current header" style="width: 200px; height: 100px; border-radius: 8px; object-fit: cover;" />
            </div>
          )}
        </label>
      </fieldset>
      <input type="submit" value="Save Changes" />
      <a href={`/users/${escapeHtml(user.username)}`} role="button" class="secondary">Cancel</a>
    </form>
  </>
);

export interface ProfileProps {
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

export const Profile: FC<ProfileProps> = ({
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
      <div style="margin-bottom: 20px;">
        <img
          src={header_data}
          alt="Profile header"
          style="width: 100%; height: 200px; border-radius: 8px; object-fit: cover;"
        />
      </div>
    )}
    <hgroup>
      <div style="display: flex; align-items: center; gap: 15px;">
        {avatar_data && (
          <img
            src={avatar_data}
            alt="Avatar"
            style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;"
          />
        )}
        <div>
          <h1>
            <a href={`/users/${escapeHtml(username)}`}>{escapeHtml(name)}</a>
          </h1>
          <p>
            <span style="user-select: all;">{handle}</span>
            {isOwnProfile && (
              <>
                {" "}&middot;{" "}
                <a href={`/users/${username}/edit`}>Edit Profile</a>
              </>
            )}
          </p>
        </div>
      </div>
      {bio && (
        <p style="margin-top: 15px; white-space: pre-wrap;">{escapeHtml(bio)}</p>
      )}
      <div style="display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap;">
        {location && (
          <span>📍 {escapeHtml(location)}</span>
        )}
        {website && (
          <span>🔗 <a href={escapeHtml(website)} target="_blank" rel="noopener noreferrer">{escapeHtml(website)}</a></span>
        )}
      </div>
      <p style="margin-top: 15px;">
        <a href={`/users/${username}/following`}>{following} following</a>{" "}
        &middot;{" "}
        <a href={`/users/${username}/followers`}>
          {followers === 1 ? "1 follower" : `${followers} followers`}
        </a>
      </p>
    </hgroup>
  </>
);

export interface FollowingListProps {
  following: Actor[];
  username?: string;
  isOwnProfile?: boolean;
}

export const FollowingList: FC<FollowingListProps> = ({ following, username, isOwnProfile = false }) => (
  <>
    <h2>Following</h2>
    {isOwnProfile && username && (
      <form method="post" action={`/users/${escapeHtml(username)}/following`} style="margin-bottom: 20px;">
        {/* biome-ignore lint/a11y/noRedundantRoles: required by picocss */}
        <fieldset role="group">
          <input
            type="text"
            name="actor"
            required={true}
            placeholder="Enter an actor handle (e.g., @johndoe@mastodon.com) or URI (e.g., https://mastodon.com/@johndoe)"
          />
          <input type="submit" value="Follow" />
        </fieldset>
      </form>
    )}
    <ul>
      {following.map((actor) => (
        <li key={actor.id}>
          <ActorLink actor={actor} />
        </li>
      ))}
    </ul>
  </>
);

export interface FollowerListProps {
  followers: Actor[];
}

export const FollowerList: FC<FollowerListProps> = ({ followers }) => (
  <>
    <h2>Followers</h2>
    <ul>
      {followers.map((follower) => (
        <li key={follower.id}>
          <ActorLink actor={follower} />
        </li>
      ))}
    </ul>
  </>
);

export interface ActorLinkProps {
  actor: Actor;
}

export const ActorLink: FC<ActorLinkProps> = ({ actor }) => {
  const href = actor.url ?? actor.uri;
  return actor.name == null ? (
    <a href={href} class="secondary">
      {escapeHtml(actor.handle)}
    </a>
  ) : (
    <>
      <a href={href}>{escapeHtml(actor.name || '')}</a>{" "}
      <small>
        (
        <a href={href} class="secondary">
          {escapeHtml(actor.handle)}
        </a>
        )
      </small>
    </>
  );
};

export interface PostPageProps extends ProfileProps, PostViewProps {}

export const PostPage: FC<PostPageProps> = (props) => (
  <>
    <Profile
      name={props.name}
      username={props.username}
      handle={props.handle}
      following={props.following}
      followers={props.followers}
    />
    <PostView post={props.post} />
  </>
);

export interface PostViewProps {
  post: Post & Actor;
}

export const PostView: FC<PostViewProps> = ({ post }) => {
  // Process content based on mediaType
  const mediaType = post.media_type || 'text/plain';
  let processedContent: string;
  
  if (mediaType === 'text/html') {
    // For HTML content, highlight mentions first, then sanitize
    const contentWithMentions = highlightMentions(post.content);
    processedContent = sanitizeActivityPubContent(contentWithMentions);
  } else {
    // For non-HTML content, process by mediaType first, then highlight mentions
    const baseProcessed = processContentByMediaType(post.content, mediaType);
    processedContent = highlightMentions(baseProcessed);
  }

  return (
    <article>
      <header>
        <ActorLink actor={post} />
      </header>
      <article dangerouslySetInnerHTML={{ __html: processedContent }} />
      <footer>
        <a href={post.url ?? post.uri}>
          <time datetime={Temporal.Instant.from(post.created + 'Z').toString()}>
            {Temporal.Instant.from(post.created + 'Z').toZonedDateTimeISO('UTC').toPlainDateTime().toLocaleString()}
          </time>
        </a>
      </footer>
    </article>
  );
};

export interface PostListProps {
  posts: (Post & Actor)[];
}

export const PostList: FC<PostListProps> = ({ posts }) => (
  <>
    {posts.map((post) => (
      <div key={post.id}>
        <PostView post={post} />
      </div>
    ))}
  </>
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

export const NotificationItem: FC<NotificationItemProps> = ({ notification }) => {
  const formatTime = (timestamp: string) => {
    const notificationTime = Temporal.Instant.from(timestamp);
    const now = Temporal.Now.instant();
    const duration = now.since(notificationTime);
    
    const totalMinutes = duration.total('minutes');
    const totalHours = duration.total('hours');
    const totalDays = duration.total('days');

    if (totalMinutes < 1) return 'just now';
    if (totalMinutes < 60) return `${Math.floor(totalMinutes)} minutes ago`;
    if (totalHours < 24) return `${Math.floor(totalHours)} hours ago`;
    return `${Math.floor(totalDays)} days ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention': return '💬';
      case 'follow': return '👤';
      case 'like': return '❤️';
      default: return '📢';
    }
  };

  return (
    <article
      class={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
      style={`
        border-left: 4px solid ${notification.is_read ? '#ccc' : '#007bff'};
        padding: 15px;
        margin-bottom: 10px;
        background: ${notification.is_read ? '#f8f9fa' : '#fff'};
        border-radius: 8px;
      `}
    >
      <header style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        {notification.related_actor_avatar && (
          <img
            src={notification.related_actor_avatar}
            alt="Avatar"
            style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
          />
        )}
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 1.2em;">{getNotificationIcon(notification.type)}</span>
            <strong>{escapeHtml(notification.related_actor_name || notification.related_actor_handle || 'Unknown user')}</strong>
            <small style="color: #666;">{formatTime(notification.created)}</small>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          {!notification.is_read && (
            <span style="width: 8px; height: 8px; background: #007bff; border-radius: 50%; display: inline-block;"></span>
          )}
          <div style="display: flex; gap: 5px;">
            {!notification.is_read && (
              <form method="post" action={`/notifications/${notification.id}/read`} style="display: inline;">
                <button type="submit" style="background: none; border: none; color: #007bff; cursor: pointer; font-size: 0.8em; text-decoration: underline; padding: 2px 4px;">Mark as read</button>
              </form>
            )}
            <form method="post" action={`/notifications/${notification.id}/delete`} style="display: inline;">
              <button type="submit" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 0.8em; text-decoration: underline; padding: 2px 4px;" onclick="return confirm('Are you sure you want to delete this notification?')">Delete</button>
            </form>
          </div>
        </div>
      </header>
      
      <div style="margin-bottom: 10px;">
        <p>{escapeHtml(notification.message)}</p>
      </div>

      {notification.post_content && (
        <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #007bff;">
          <div dangerouslySetInnerHTML={{ __html: processContentByMediaType(notification.post_content, 'text/html') }} />
          {notification.post_uri && (
            <div style="margin-top: 8px;">
              <a href={notification.post_uri} style="font-size: 0.9em; color: #007bff;">View post</a>
            </div>
          )}
        </div>
      )}
    </article>
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

export const NotificationList: FC<NotificationListProps> = ({ notifications }) => (
  <div class="notification-list">
    {notifications.length === 0 ? (
      <div style="text-align: center; padding: 40px; color: #666;">
        <p style="font-size: 1.2em; margin-bottom: 10px;">📭</p>
        <p>No notifications</p>
      </div>
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
  total = 0
}) => {
  const hasUnreadNotifications = notifications.some(n => !n.is_read);
  
  return (
    <>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <hgroup>
          <h1>Notifications</h1>
          <p>View your latest notifications {total > 0 && `(${total} total)`}</p>
        </hgroup>
        <div style="display: flex; gap: 10px;">
          <a href="/" role="button" class="secondary">Back to home</a>
          {hasUnreadNotifications && (
            <form method="post" action="/notifications/mark-all-read" style="display: inline;">
              <button type="submit" class="outline">Mark all as read</button>
            </form>
          )}
          {notifications.length > 0 && (
            <form method="post" action="/notifications/clear" style="display: inline;">
              <button type="submit" class="secondary" onclick="return confirm('Are you sure you want to clear all notifications?')">Clear all</button>
            </form>
          )}
        </div>
      </div>
      
      <NotificationList notifications={notifications} />
      
      {totalPages > 1 && (
        <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 30px;">
          {currentPage > 1 && (
            <>
              <a href="/notifications?page=1" role="button" class="secondary outline">First</a>
              <a href={`/notifications?page=${currentPage - 1}`} role="button" class="secondary outline">Previous</a>
            </>
          )}
          
          <span style="padding: 0 15px; color: #666;">
            Page {currentPage} of {totalPages}
          </span>
          
          {currentPage < totalPages && (
            <>
              <a href={`/notifications?page=${currentPage + 1}`} role="button" class="secondary outline">Next</a>
              <a href={`/notifications?page=${totalPages}`} role="button" class="secondary outline">Last</a>
            </>
          )}
        </div>
      )}
    </>
  );
};

export interface NotificationBadgeProps {
  count: number;
}

export const NotificationBadge: FC<NotificationBadgeProps> = ({ count }) => (
  <span style="display: flex; align-items: center; gap: 6px;">
    🔔
    {count > 0 && (
      <span style="
        background: #dc3545;
        color: white;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 0.75em;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
        line-height: 1.2;
      ">
        {count > 99 ? '99+' : count}
      </span>
    )}
  </span>
);

// Mention highlight component
export interface MentionHighlightProps {
  content: string;
}

export const MentionHighlight: FC<MentionHighlightProps> = ({ content }) => {
  const highlightedContent = highlightMentions(content);
  
  return (
    <span dangerouslySetInnerHTML={{ __html: processContentByMediaType(highlightedContent, 'text/html') }} />
  );
};
