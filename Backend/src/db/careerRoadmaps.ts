import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { milestoneStatusEnum } from "./enums";
import { users } from "./users";

// AI-generated career roadmaps
export const careerRoadmaps = pgTable("career_roadmaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobSeekerId: uuid("job_seeker_id")
    .references(() => users.id)
    .notNull(),
  target: varchar("target", { length: 200 }).notNull(),
  goal: text("goal"),
  targetTimeline: varchar("target_timeline", { length: 50 }),
  currentMilestone: integer("current_milestone").default(0),
  totalMilestones: integer("total_milestones").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Individual milestones within a career roadmap
export const roadmapMilestones = pgTable("roadmap_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapId: uuid("roadmap_id")
    .references(() => careerRoadmaps.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  actionItems: jsonb("action_items"),
  resources: jsonb("resources"),
  status: milestoneStatusEnum("status").default("pending"),
  estimatedWeeks: integer("estimated_weeks"),
  completedAt: timestamp("completed_at"),
});
