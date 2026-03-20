import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  date,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { resumeStatusEnum } from "./enums";
import { users } from "./users";
import { skillsMaster } from "./skillsMaster";
import { vector } from "./customTypes";

// Main resumes table
export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 20 }).notNull(),
  isPrimary: boolean("is_primary").default(false),
  status: resumeStatusEnum("status").default("pending"),
  parsedData: jsonb("parsed_data"),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Education entries extracted from resumes
export const resumeEducation = pgTable("resume_education", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .references(() => resumes.id, { onDelete: "cascade" })
    .notNull(),
  degree: varchar("degree", { length: 100 }),
  stream: varchar("stream", { length: 150 }),
  institution: varchar("institution", { length: 255 }),
  branch: varchar("branch", { length: 150 }),
  year: integer("year"),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  board: varchar("board", { length: 100 }),
});

// Work experience entries from resumes
export const resumeExperience = pgTable("resume_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .references(() => resumes.id, { onDelete: "cascade" })
    .notNull(),
  companyName: varchar("company_name", { length: 255 }),
  role: varchar("role", { length: 150 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  description: text("description"),
  isCurrent: boolean("is_current").default(false),
});

// Skills extracted from resumes, linked to skills_master
export const resumeSkills = pgTable(
  "resume_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .references(() => resumes.id, { onDelete: "cascade" })
      .notNull(),
    skillId: uuid("skill_id")
      .references(() => skillsMaster.id)
      .notNull(),
    skillType: varchar("skill_type", { length: 50 }),
    source: varchar("source", { length: 50 }),
  },
  (table) => [unique().on(table.resumeId, table.skillId)]
);

// Projects listed on the resume
export const resumeProjects = pgTable("resume_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .references(() => resumes.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  techUsed: text("tech_used"),
  githubUrl: varchar("github_url", { length: 500 }),
  role: varchar("role", { length: 100 }),
});

// Certifications from the resume
export const resumeCertifications = pgTable("resume_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .references(() => resumes.id, { onDelete: "cascade" })
    .notNull(),
  certName: varchar("cert_name", { length: 255 }).notNull(),
  organization: varchar("organization", { length: 255 }),
  url: varchar("url", { length: 500 }),
});

// AI-generated resume feedback
export const resumeFeedback = pgTable("resume_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .references(() => resumes.id, { onDelete: "cascade" })
    .notNull(),
  overallScore: integer("overall_score").notNull(),
  sectionScores: jsonb("section_scores"),
  suggestions: jsonb("suggestions"),
  keywordAnalysis: jsonb("keyword_analysis"),
  formattingIssues: jsonb("formatting_issues"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
