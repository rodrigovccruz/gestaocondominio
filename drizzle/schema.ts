import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const condoStates = mysqlTable("condo_states", {
  ownerId: int("ownerId")
    .notNull()
    .references(() => users.id)
    .unique(),
  revision: int("revision").notNull(),
  state: json("state").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CondoStateRecord = typeof condoStates.$inferSelect;
export type InsertCondoState = typeof condoStates.$inferInsert;

/** A resident's current membership in one condominium and unit. */
export const condoMemberships = mysqlTable(
  "condo_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    unitId: varchar("unitId", { length: 80 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userIdUnique: uniqueIndex("condo_memberships_userId_unique").on(
      table.userId
    ),
    ownerUnitUnique: uniqueIndex("condo_memberships_ownerId_unitId_unique").on(
      table.ownerId,
      table.unitId
    ),
  })
);

export type CondoMembership = typeof condoMemberships.$inferSelect;
export type InsertCondoMembership = typeof condoMemberships.$inferInsert;

/** Invitation credentials are retained only as a SHA-256 token hash. */
export const condoInvites = mysqlTable(
  "condo_invites",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id),
    email: varchar("email", { length: 320 }).notNull(),
    unitId: varchar("unitId", { length: 80 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tokenHashUnique: uniqueIndex("condo_invites_tokenHash_unique").on(
      table.tokenHash
    ),
  })
);

export type CondoInvite = typeof condoInvites.$inferSelect;
export type InsertCondoInvite = typeof condoInvites.$inferInsert;

/** Opaque application sessions; only the SHA-256 token digest is persisted. */
export const syndicSessions = mysqlTable(
  "syndic_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tokenHashUnique: uniqueIndex("syndic_sessions_tokenHash_unique").on(
      table.tokenHash
    ),
  })
);

export type SyndicSessionRecord = typeof syndicSessions.$inferSelect;
export type InsertSyndicSession = typeof syndicSessions.$inferInsert;

/** Persistent login-attempt counters keyed by global scope or client IP. */
export const syndicLoginRateLimits = mysqlTable("syndic_login_rate_limits", {
  scope: varchar("scope", { length: 255 }).primaryKey(),
  failures: int("failures").notNull().default(0),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  blockedUntil: timestamp("blockedUntil"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyndicLoginRateLimit = typeof syndicLoginRateLimits.$inferSelect;
export type InsertSyndicLoginRateLimit =
  typeof syndicLoginRateLimits.$inferInsert;
