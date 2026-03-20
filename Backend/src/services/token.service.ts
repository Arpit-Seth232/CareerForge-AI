import crypto from "crypto";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "../errors/AppError";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createVerificationToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  await db.insert(schema.verificationTokens).values({
    userId,
    token: hashedToken,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
  });

  return rawToken;
}

export async function consumeVerificationToken(rawToken: string): Promise<string> {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  const [record] = await db
    .select()
    .from(schema.verificationTokens)
    .where(
      and(
        eq(schema.verificationTokens.token, hashedToken),
        eq(schema.verificationTokens.isUsed, false)
      )
    );

  if (!record) {
    throw new AppError("Invalid or already used token", 400, "INVALID_TOKEN");
  }

  if (new Date() > record.expiresAt) {
    throw new AppError("Token has expired", 400, "TOKEN_EXPIRED");
  }

  // Atomically mark token used and verify email
  await db.transaction(async (tx) => {
    await tx
      .update(schema.verificationTokens)
      .set({ isUsed: true })
      .where(eq(schema.verificationTokens.id, record.id));

    await tx
      .update(schema.users)
      .set({ isEmailVerified: true })
      .where(eq(schema.users.id, record.userId));
  });

  return record.userId;
}
