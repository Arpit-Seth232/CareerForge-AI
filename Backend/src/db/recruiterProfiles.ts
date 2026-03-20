import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { companies } from "./companies";

export const recruiterProfiles = pgTable("recruiter_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  companyId: uuid("company_id").references(() => companies.id),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 150 }),
  jobLocation: varchar("job_location", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
