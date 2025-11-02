import dotenv from "dotenv";
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const ServerPort = process.env.PORT ;
export const DATABASE_URL = process.env.DATABASE_URLe ;