import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Tracks all ML models used across the platform
export const mlModelVersions = pgTable(
  "ml_model_versions",
  {
    modelId: uuid("model_id").primaryKey().defaultRandom(),
    modelName: varchar("model_name", { length: 255 }).notNull(),
    modelVersion: varchar("model_version", { length: 50 }).notNull(),
    modelType: varchar("model_type", { length: 100 }),
    config: jsonb("config"),
    accuracy: decimal("accuracy", { precision: 5, scale: 4 }),
    precisionScore: decimal("precision_score", { precision: 5, scale: 4 }),
    recallScore: decimal("recall_score", { precision: 5, scale: 4 }),
    f1Score: decimal("f1_score", { precision: 5, scale: 4 }),
    isActive: boolean("is_active").default(false),
    deployedAt: timestamp("deployed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.modelName, table.modelVersion)]
);

// Stores every ML prediction for auditing and explainability
export const mlPredictions = pgTable("ml_predictions", {
  predictionId: uuid("prediction_id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .references(() => mlModelVersions.modelId)
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }),
  explanation: jsonb("explanation"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
