import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const resumeSourceEnum = pgEnum("resume_source", ["upload", "voice"]);

export const resumes = pgTable("resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  fileUrl: varchar("file_url", { length: 100 }).notNull(),
  version: integer("version").default(1),
  parsedSkills: text("parsed_skills").array(),
  parsedExperience: jsonb("parsed_experience"),
  parsedEducation: jsonb("parsed_education"),
  source: resumeSourceEnum("source").default("upload").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
