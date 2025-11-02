import { Response } from "express";
import { IRequest } from "../middleware/authMiddleware";
import { schema } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

const role = async (req: IRequest, res: Response) => {
  const role = req.body.role;

  if (!role) {
    return res.status(400).json({
      isSuccess: false,
      message: "Please select a role",
    });
  }

  if (!req.userId) {
    return res.status(400).json({
      isSuccess: false,
      message: "User ID not found",
    });
  }

  try {
    // Update user role
    // Assuming you have a users table with a role column
    const userData = await db
      .update(schema.users)
      .set({
        role,
      })
      .where(eq(schema.users.id, req?.userId));
    return res.status(200).json({
      isSuccess: true,
      message: "Role updated successfully",
      data: userData,
    });
  } catch (error) {
    console.error("Error during role selection:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default role;
