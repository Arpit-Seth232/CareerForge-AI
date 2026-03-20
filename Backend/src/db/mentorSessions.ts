import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { sessionStatusEnum } from "./enums";
import { users } from "./users";

// Mentoring sessions
export const mentorSessions = pgTable("mentor_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  mentorId: uuid("mentor_id")
    .references(() => users.id)
    .notNull(),
  menteeId: uuid("mentee_id")
    .references(() => users.id)
    .notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(30),
  status: sessionStatusEnum("status").default("scheduled"),
  meetingLink: varchar("meeting_link", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Public reviews for mentor profiles (one review per session)
export const mentorReviews = pgTable("mentor_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => mentorSessions.id)
    .notNull()
    .unique(),
  mentorId: uuid("mentor_id")
    .references(() => users.id)
    .notNull(),
  menteeId: uuid("mentee_id")
    .references(() => users.id)
    .notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
