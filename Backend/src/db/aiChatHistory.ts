import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const senderTypeEnum = pgEnum("sender_type", ["user", "ai"]);

export const aiChatHistory = pgTable("ai_chat_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  threadId: text("thread_id"),
  message: text("message").notNull(),
  sender: senderTypeEnum("sender").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
