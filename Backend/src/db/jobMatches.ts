import {
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const jobMatches = pgTable("job_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  jobTitle: varchar("job_title", { length: 50 }).notNull(),
  matchScore: real("match_score").notNull(),
  matchedSkills: text("matched_skills").array(),
  missingSkills: text("missing_skills").array(),
  jobDescription: text("job_description"),
  explanation: jsonb("explanation"),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
});
