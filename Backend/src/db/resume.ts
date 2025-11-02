// resume table
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./user";

export const resume = pgTable("resume", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  resume: text("resume"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});