import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { workTypeEnum } from "./enums";
import { users } from "./users";

export const jobSeekerProfiles = pgTable("job_seeker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  bio: text("bio"),
  yearOfExp: integer("year_of_exp").default(0),
  currentTitle: varchar("current_title", { length: 150 }),
  experienceLevel: varchar("experience_level", { length: 50 }),
  rolePreference: varchar("role_preference", { length: 200 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  githubUrl: varchar("github_url", { length: 500 }),
  phone: varchar("phone", { length: 20 }),
  claimedLocation: varchar("claimed_location", { length: 200 }),
  workTypePref: workTypeEnum("work_type_pref"),
  salaryExpMin: decimal("salary_exp_min", { precision: 12, scale: 2 }),
  salaryExpMax: decimal("salary_exp_max", { precision: 12, scale: 2 }),
  willingToRelocate: boolean("willing_to_relocate").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
