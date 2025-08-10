import {
  jsonb,
  pgTable,
  real,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const roadmaps = pgTable("roadmaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  goal: varchar("goal", { length: 100 }).notNull(),
  roadmapData: jsonb("roadmap_data").notNull(),
  progress: real("progress").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
