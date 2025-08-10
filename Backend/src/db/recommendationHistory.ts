import { jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const recommendationTypeEnum = pgEnum("recommendation_type", [
  "job",
  "mentor",
  "roadmap",
]);

export const recommendationHistory = pgTable("recommendation_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: recommendationTypeEnum("type").notNull(),
  data: jsonb("data").notNull(),
  recommendedAt: timestamp("recommended_at").defaultNow().notNull(),
});
