import { boolean, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./user";

export const mentors = pgTable("mentors", {
  id: varchar("id")
    .references(() => users.id)
    .primaryKey(),
  fullName: varchar("full_name", { length: 20 }).notNull(),
  expertise: text("expertise").array(),
  profilePicture: text("profile_picture"),
  bio: text("bio"),
  yearOfMentoring: varchar("year_of_mentoring", { length: 10 }),
  availability: jsonb("availability"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
