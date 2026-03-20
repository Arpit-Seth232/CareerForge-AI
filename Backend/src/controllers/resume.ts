import { Response } from "express";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import { AuthenticationError, NotFoundError } from "../errors/AppError";
import { ML_API_URL } from "../config";

const getUserResumes = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const resumes = await db
    .select({
      id: schema.resumes.id,
      fileName: schema.resumes.fileName,
      fileType: schema.resumes.fileType,
      status: schema.resumes.status,
      isPrimary: schema.resumes.isPrimary,
      createdAt: schema.resumes.createdAt,
    })
    .from(schema.resumes)
    .where(eq(schema.resumes.userId, req.userId))
    .orderBy(desc(schema.resumes.createdAt));

  res.status(200).json({
    isSuccess: true,
    message: "Resumes retrieved successfully",
    data: resumes,
  });
});

const setPrimaryResume = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [resume] = await db
    .select({ id: schema.resumes.id })
    .from(schema.resumes)
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, req.userId)));

  if (!resume) throw new NotFoundError("Resume not found");

  // Find the current primary resume (to clear its embedding later)
  const [oldPrimary] = await db
    .select({ id: schema.resumes.id })
    .from(schema.resumes)
    .where(
      and(eq(schema.resumes.userId, req.userId), eq(schema.resumes.isPrimary, true))
    );

  // Toggle primary flag
  await db
    .update(schema.resumes)
    .set({ isPrimary: false })
    .where(eq(schema.resumes.userId, req.userId));

  await db
    .update(schema.resumes)
    .set({ isPrimary: true })
    .where(eq(schema.resumes.id, id));

  // Trigger embedding generation for new primary & clear old primary's embedding
  try {
    await fetch(`${ML_API_URL}/api/v1/resume/embedding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_id: id,
        old_primary_id: oldPrimary?.id !== id ? oldPrimary?.id : null,
      }),
    });
  } catch (err) {
    console.error("Failed to trigger embedding generation:", err);
  }

  res.status(200).json({
    isSuccess: true,
    message: "Primary resume updated successfully",
  });
});

export { getUserResumes, setPrimaryResume };
