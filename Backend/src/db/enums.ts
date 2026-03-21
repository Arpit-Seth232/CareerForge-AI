import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "job_seeker",
  "recruiter",
  "mentor",
]);

export const workTypeEnum = pgEnum("work_type", [
  "remote",
  "hybrid",
  "onsite",
]);

export const resumeStatusEnum = pgEnum("resume_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
]);

export const jobSourceEnum = pgEnum("job_source", [
  "posted",
  "scraped",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "shortlisted",
  "interview",
  "offered",
  "rejected",
  "withdrawn",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);
