import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  first_name: varchar("first_name", { length: 20 }).notNull(),
  last_name: varchar("last_name", { length: 20 }).notNull(),
  email: varchar("email", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 20 }),
  socialProvider: varchar("social_provider", { length: 20 }),
  profilePicture: varchar("profile_picture", { length: 100 }),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
