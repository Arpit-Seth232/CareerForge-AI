import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

export interface IRequest extends Request {
  userId?: string;
}

const verifyToken = async (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    console.log("Token verification error:", error);
    return null;
  }
};

const authMiddleware = async (
  req: IRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from cookies first, then from Authorization header
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const decoded = await verifyToken(token);
    if (!decoded) {
      return res
        .status(401)
        .json({ isSuccess: false, message: "Unauthorized", data: {} });
    }
    
    req.userId = decoded.userId;
    next();
  } catch (error: any) {
    console.log("---------", error?.message);
    return res
      .status(500)
      .json({ isSuccess: false, message: "Internal Server Error", data: {} });
  }
};

export default authMiddleware;
