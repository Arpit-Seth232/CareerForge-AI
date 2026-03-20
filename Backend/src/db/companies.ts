import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  website: varchar("website", { length: 500 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  industry: varchar("industry", { length: 150 }),
  companySize: varchar("company_size", { length: 50 }),
  hqLocation: varchar("hq_location", { length: 200 }),
  description: text("description"),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
