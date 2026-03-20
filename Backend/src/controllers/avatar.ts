import { Response } from "express";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import { AuthenticationError, ValidationError } from "../errors/AppError";
import supabase from "../services/supabase";
import crypto from "crypto";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

const uploadAvatar = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const contentType = req.headers["content-type"] || "";

  if (!contentType.startsWith("image/")) {
    throw new ValidationError("Request must have an image content-type");
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new ValidationError(`Only ${ALLOWED_TYPES.join(", ")} are allowed`);
  }

  // Read raw body (Buffer) — express.raw() middleware handles this
  const buffer = req.body as Buffer;

  if (!buffer || buffer.length === 0) {
    throw new ValidationError("No image data received");
  }

  if (buffer.length > MAX_SIZE) {
    throw new ValidationError("File size exceeds 2 MB limit");
  }

  const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
  const fileName = `avatars/${req.userId}/${crypto.randomUUID()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("avatar")
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("avatar")
    .getPublicUrl(fileName);

  const avatarUrl = urlData.publicUrl;

  // Update user record
  await db
    .update(schema.users)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(schema.users.id, req.userId));

  res.status(200).json({
    isSuccess: true,
    message: "Avatar updated successfully",
    data: { avatarUrl },
  });
});

export { uploadAvatar };
