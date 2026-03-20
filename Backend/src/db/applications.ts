import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { applicationStatusEnum } from "./enums";
import { users } from "./users";
import { jobs } from "./jobs";
import { resumes } from "./resumes";

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .references(() => jobs.id)
      .notNull(),
    jobSeekerId: uuid("job_seeker_id")
      .references(() => users.id)
      .notNull(),
    resumeId: uuid("resume_id").references(() => resumes.id),
    status: applicationStatusEnum("status").default("applied"),
    matchScore: decimal("match_score", { precision: 5, scale: 2 }),
    coverLetter: text("cover_letter"),
    appliedAt: timestamp("applied_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.jobId, table.jobSeekerId)]
);
