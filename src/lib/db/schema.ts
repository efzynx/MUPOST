import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  smallint,
  jsonb,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ==========================================
// PostgreSQL Enums
// ==========================================

export const platformTypeEnum = pgEnum("platform_type", ["META_PAGE", "INSTAGRAM", "TIKTOK"]);

export const accountStatusEnum = pgEnum("account_status", ["ACTIVE", "EXPIRED", "NEEDS_REAUTH"]);

export const postStatusEnum = pgEnum("post_status", [
  "DRAFT",
  "SCHEDULED",
  "QUEUED",
  "PUBLISHED",
  "PARTIAL",
  "FAILED",
]);

export const targetStatusEnum = pgEnum("target_status", ["PENDING", "PUBLISHED", "FAILED"]);

// ==========================================
// Tables
// ==========================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: index("idx_sessions_token_hash").on(table.tokenHash),
    userIdIdx: index("idx_sessions_user_id").on(table.userId),
  })
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformTypeEnum("platform").notNull(),
    platformAccountId: varchar("platform_account_id", { length: 255 }).notNull(),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    status: accountStatusEnum("status").notNull().default("ACTIVE"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userPlatformAccountUnique: unique("unique_user_platform_account").on(
      table.userId,
      table.platform,
      table.platformAccountId
    ),
    userIdIdx: index("idx_connected_accounts_user_id").on(table.userId),
    expiresIdx: index("idx_connected_accounts_expires").on(table.tokenExpiresAt),
  })
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    textContent: text("text_content").notNull(),
    mediaUrls: text("media_urls").array(),
    status: postStatusEnum("status").notNull().default("DRAFT"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retryCount: smallint("retry_count").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("FORM"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_posts_user_id").on(table.userId),
    statusIdx: index("idx_posts_status").on(table.status),
    scheduledIdx: index("idx_posts_scheduled").on(table.scheduledAt),
  })
);

export const postTargets = pgTable(
  "post_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id),
    platform: platformTypeEnum("platform").notNull(),
    status: targetStatusEnum("status").notNull().default("PENDING"),
    platformPostId: varchar("platform_post_id", { length: 255 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    retryCount: smallint("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index("idx_post_targets_post_id").on(table.postId),
    statusIdx: index("idx_post_targets_pending").on(table.status),
  })
);

// ==========================================
// Relations
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  connectedAccounts: many(connectedAccounts),
  posts: many(posts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [connectedAccounts.userId],
    references: [users.id],
  }),
  postTargets: many(postTargets),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  targets: many(postTargets),
}));

export const postTargetsRelations = relations(postTargets, ({ one }) => ({
  post: one(posts, {
    fields: [postTargets.postId],
    references: [posts.id],
  }),
  connectedAccount: one(connectedAccounts, {
    fields: [postTargets.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));

// ==========================================
// Type Definitions
// ==========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type PostTarget = typeof postTargets.$inferSelect;
export type NewPostTarget = typeof postTargets.$inferInsert;

export type PlatformType = (typeof platformTypeEnum.enumValues)[number];
export type AccountStatus = (typeof accountStatusEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type TargetStatus = (typeof targetStatusEnum.enumValues)[number];
