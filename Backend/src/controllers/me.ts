import { Response } from "express";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import { getUserWithProfile } from "../services/auth.service";
import { AuthenticationError, NotFoundError } from "../errors/AppError";

const Me = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) {
    throw new AuthenticationError();
  }

  const userData = await getUserWithProfile(req.userId);

  if (!userData) {
    throw new NotFoundError("User not found");
  }

  res.status(200).json({
    isSuccess: true,
    message: "User information retrieved successfully",
    data: userData,
  });
});

export default Me;
