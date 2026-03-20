import { Response } from "express";
import { IRequest } from "../middleware/authMiddleware";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { catchAsync } from "../utils/catchAsync";
import { AuthenticationError } from "../errors/AppError";

const role = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) {
    throw new AuthenticationError();
  }

  const { role } = req.body;

  await db
    .update(schema.users)
    .set({ role })
    .where(eq(schema.users.id, req.userId));

  res.status(200).json({
    isSuccess: true,
    message: "Role updated successfully",
  });
});

export default role;
