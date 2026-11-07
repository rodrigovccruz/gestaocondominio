import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);

/** Dono do condomínio (o síndico). Só existe uma linha em uso. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Estado inteiro do condomínio em JSON, com revisão para evitar sobrescrita. */
export const condoStates = pgTable("condo_states", {
  ownerId: integer("ownerId")
    .notNull()
    .references(() => users.id)
    .unique(),
  revision: integer("revision").notNull(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type CondoStateRecord = typeof condoStates.$inferSelect;
export type InsertCondoState = typeof condoStates.$inferInsert;

/** Sessões do síndico; só o hash SHA-256 do token fica salvo. */
export const syndicSessions = pgTable(
  "syndic_sessions",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("syndic_sessions_tokenHash_unique").on(table.tokenHash)]
);

export type SyndicSessionRecord = typeof syndicSessions.$inferSelect;
export type InsertSyndicSession = typeof syndicSessions.$inferInsert;

/** Tentativas de login por escopo (global ou IP). */
export const syndicLoginRateLimits = pgTable("syndic_login_rate_limits", {
  scope: varchar("scope", { length: 255 }).primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  blockedUntil: timestamp("blockedUntil"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type SyndicLoginRateLimit = typeof syndicLoginRateLimits.$inferSelect;
export type InsertSyndicLoginRateLimit =
  typeof syndicLoginRateLimits.$inferInsert;
