import { boolean, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["jobseeker", "recruiter", "mentor"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 20 }),
  role: userRoleEnum("role"),
  isProfileCompleted: boolean("is_profile_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
