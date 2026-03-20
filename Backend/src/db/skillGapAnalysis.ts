import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { jobs } from "./jobs";

export const skillGapAnalysis = pgTable("skill_gap_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobSeekerId: uuid("job_seeker_id")
    .references(() => users.id)
    .notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  matchScore: decimal("match_score", { precision: 5, scale: 2 }),
  missingSkills: text("missing_skills").array(),
  recommendations: jsonb("recommendations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
