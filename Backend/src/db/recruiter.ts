import { boolean, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./user";

export const recruiter = pgTable("recruiter", {
  id: varchar("id")
    .references(() => users.id)
    .primaryKey(),
  fullName: varchar("full_name", { length: 30 }).notNull(),
  companyName: varchar("company_name", { length: 50 }).notNull(),
  profilePicture: varchar("profile_picture", { length: 100 }),
  jobTitle: varchar("job_title", { length: 50 }),
  companySize: varchar("company_size", { length: 20 }),
  industry: varchar("industry", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
