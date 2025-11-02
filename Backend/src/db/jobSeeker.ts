import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./user";

export const jobSeeker = pgTable("job_seeker", {
  id: varchar("id")
    .references(() => users.id)
    .primaryKey(),
  fullName: varchar("full_name", { length: 30 }).notNull(),
  profilePicture: varchar("profile_picture", { length: 100 }),
  yearOfExperience: varchar("year_of_experience", { length: 20 }),
  bio: text("bio"),
  preferredRoles: varchar("preferred_roles", { length: 100 }).array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
