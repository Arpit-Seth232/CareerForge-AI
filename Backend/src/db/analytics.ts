import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const analytics = pgTable("analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
