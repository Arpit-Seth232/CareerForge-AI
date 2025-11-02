import { Request, Response } from "express";
import { schema } from "../db/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

const Signin = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({
        isSuccess: false,
        message: "Please enter all details",
      });
    }
    let existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if(!existingUser.length){
      return res.status(400).json({
        isSuccess: false,
        message: "User not found",
      });
    }
    if(existingUser[0].password !== password){
      return res.status(400).json({
        isSuccess: false,
        message: "Invalid password or email",
      });
    }
    
    const token = jwt.sign(
      { userId: existingUser[0].id, email: existingUser[0].email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    // Set JWT token as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.status(200).json({
      isSuccess: true,
      message: "User logged in successfully",
      data: { userId: existingUser[0].id, email: existingUser[0].email },
    });
  } catch (error) {
    return res.status(500).json({
      isSuccess: false,
      message: "Internal server error",
      error: error,
    });
  }
};

export default Signin;
