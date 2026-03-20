import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { JWT_SECRET } from "../config";
import {
  ConflictError,
  AuthenticationError,
  ForbiddenError,
} from "../errors/AppError";
import { createVerificationToken } from "./token.service";
import { sendVerificationEmail } from "./mailer.service";

const SALT_ROUNDS = 12;
const JWT_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export interface TokenCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  maxAge: number;
}

export function getCookieOptions(): TokenCookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function registerUser(email: string, password: string) {
  // Check for existing user
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role: "job_seeker" })
    .returning({ id: schema.users.id, email: schema.users.email });

  // Generate token and send verification email
  const rawToken = await createVerificationToken(user.id);
  sendVerificationEmail(email, rawToken).catch((err) =>
    console.error("Failed to send verification email:", err)
  );

  return { email: user.email };
}

export async function authenticateUser(email: string, password: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (!user) {
    throw new AuthenticationError("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError("Invalid email or password");
  }

  if (!user.isEmailVerified) {
    throw new ForbiddenError(
      "Please verify your email before signing in",
      "EMAIL_NOT_VERIFIED"
    );
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  // Update last login
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id));

  return { token, userId: user.id, email: user.email };
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getUserWithProfile(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  let profile = null;

  if (user.role === "job_seeker") {
    const [data] = await db
      .select()
      .from(schema.jobSeekerProfiles)
      .where(eq(schema.jobSeekerProfiles.userId, userId));
    profile = data ?? null;
  } else if (user.role === "recruiter") {
    const [data] = await db
      .select()
      .from(schema.recruiterProfiles)
      .where(eq(schema.recruiterProfiles.userId, userId));
    profile = data ?? null;
  } else if (user.role === "mentor") {
    const [data] = await db
      .select()
      .from(schema.mentorProfiles)
      .where(eq(schema.mentorProfiles.userId, userId));
    profile = data ?? null;
  }

  return { ...user, profile };
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const [user] = await db
    .select({ isEmailVerified: schema.users.isEmailVerified })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  return user?.isEmailVerified ?? false;
}

export async function resendVerificationForEmail(email: string) {
  const [user] = await db
    .select({ id: schema.users.id, isEmailVerified: schema.users.isEmailVerified })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  // Silent success if user doesn't exist (prevent enumeration)
  if (!user) return;

  if (user.isEmailVerified) {
    throw new ConflictError("Email is already verified");
  }

  const rawToken = await createVerificationToken(user.id);
  await sendVerificationEmail(email, rawToken);
}
