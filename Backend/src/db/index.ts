import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";
import { schema } from "./schema";

console.log(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
