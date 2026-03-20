import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { catchAsync } from "../utils/catchAsync";
import { ValidationError } from "../errors/AppError";
import { consumeVerificationToken } from "../services/token.service";
import { resendVerificationForEmail, isEmailVerified, getCookieOptions, getUserById } from "../services/auth.service";
import { JWT_SECRET } from "../config";

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  // Prevent 304 caching — each verification attempt must hit the server
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");

  const { token } = req.query;

  if (!token || typeof token !== "string") {
    throw new ValidationError("Verification token is required");
  }

  const userId = await consumeVerificationToken(token);
  const user = await getUserById(userId);

  const jwtToken = jwt.sign(
    { userId, email: user?.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", jwtToken, getCookieOptions());

  res.status(200).json({
    isSuccess: true,
    message: "Email verified successfully",
  });
});

export const checkVerificationStatus = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.query;

  if (!email || typeof email !== "string") {
    throw new ValidationError("Email is required");
  }

  const verified = await isEmailVerified(email);

  res.status(200).json({ isVerified: verified });
});

export const resendVerification = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  await resendVerificationForEmail(email);

  // Always return success to prevent email enumeration
  res.status(200).json({
    isSuccess: true,
    message: "If that email exists, a verification link has been sent",
  });
});
