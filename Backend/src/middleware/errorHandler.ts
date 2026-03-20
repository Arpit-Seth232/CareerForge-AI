import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { NODE_ENV } from "../config";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      isSuccess: false,
      message: err.message,
      code: err.code,
    });
  }

  // Unexpected errors
  console.error("Unhandled error:", err);

  return res.status(500).json({
    isSuccess: false,
    message: NODE_ENV === "production" ? "Internal server error" : err.message,
    code: "INTERNAL_ERROR",
  });
}
