import { jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

export const mentors = pgTable("mentors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 20 }).notNull(),
  expertise: text("expertise").array(),
  profilePicture: text("profile_picture"),
  bio: text("bio"),
  availability: jsonb("availability"),
});
