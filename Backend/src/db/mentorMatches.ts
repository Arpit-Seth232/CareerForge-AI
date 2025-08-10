import { pgTable, real, timestamp, uuid } from "drizzle-orm/pg-core";
import { mentors } from "./mentors";
import { users } from "./users";

export const mentorMatches = pgTable("mentor_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  mentorId: uuid("mentor_id").references(() => mentors.id, {
    onDelete: "cascade",
  }),
  menteeId: uuid("mentee_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  matchScore: real("match_score").notNull(),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
});
