import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import { DATABASE_URL } from "./config";
dotenv.config();

console.log(DATABASE_URL);


export default defineConfig({
  schema: "./db",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL!,
  },
});
