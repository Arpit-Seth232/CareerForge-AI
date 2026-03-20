import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const mentorProfiles = pgTable("mentor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  title: varchar("title", { length: 150 }),
  company: varchar("company", { length: 255 }),
  yearsOfExp: integer("years_of_exp").default(0),
  expertiseAreas: text("expertise_areas").array(),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  isAvailable: boolean("is_available").default(true),
  preferredSlots: jsonb("preferred_slots"),
  pricePerSession: decimal("price_per_session", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
