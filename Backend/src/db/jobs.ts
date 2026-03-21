import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { jobTypeEnum, workTypeEnum, jobSourceEnum } from "./enums";
import { users } from "./users";
import { companies } from "./companies";
import { skillsMaster } from "./skillsMaster";
import { vector } from "./customTypes";

// Job postings by recruiters
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: uuid("recruiter_id").references(() => users.id),
  companyId: uuid("company_id").references(() => companies.id),
  source: jobSourceEnum("source").default("posted").notNull(),
  jobTitle: varchar("job_title", { length: 200 }).notNull(),
  jobDescription: text("job_description").notNull(),
  jobRequirement: text("job_requirement"),
  minExperience: integer("min_experience").default(0),
  maxExperience: integer("max_experience"),
  minSalary: decimal("min_salary", { precision: 12, scale: 2 }),
  maxSalary: decimal("max_salary", { precision: 12, scale: 2 }),
  jobLocation: varchar("job_location", { length: 200 }),
  jobType: jobTypeEnum("job_type"),
  workType: workTypeEnum("work_type"),
  isActive: boolean("is_active").default(true),
  openSlots: integer("open_slots").default(1),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Skills required for each job
export const jobSkills = pgTable(
  "job_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    skillId: uuid("skill_id")
      .references(() => skillsMaster.id)
      .notNull(),
    importanceWeight: decimal("importance_weight", {
      precision: 3,
      scale: 2,
    })
      .notNull()
      .default("1.00"),
  },
  (table) => [unique().on(table.jobId, table.skillId)]
);

// Bookmarked/saved jobs by job seekers
export const savedJobs = pgTable(
  "saved_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    jobId: uuid("job_id")
      .references(() => jobs.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.jobId)]
);
