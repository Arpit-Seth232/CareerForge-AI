import dotenv from "dotenv";
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const ServerPort = Number(process.env.PORT) || 3000;
export const DATABASE_URL = process.env.DATABASE_URL;
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";

// ML service
export const ML_API_URL = process.env.ML_API_URL || "http://localhost:8000";

// Email config (SMTP)
export const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
export const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
export const SMTP_USER = process.env.SMTP_USER || "";
export const SMTP_PASS = process.env.SMTP_PASS || "";
export const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
