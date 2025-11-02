import { Request, Response } from "express";
import { schema } from "../db/schema";
import { db } from "../db";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

const Signup = async (req: Request, res: Response) => {
  const { email, password , confirmPassword } = req.body;
  try {
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        isSuccess: false,
        message: "Please enter all details",
      });
    }
    if(password !== confirmPassword){
      return res.status(400).json({
        isSuccess: false,
        message: "Password and confirm password do not match",
      });
    }
    
    let existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if(existingUser.length > 0){
      return res.status(400).json({
        isSuccess: false,
        message: "User already exists",
      });
    }
    
    const userId = randomUUID();
    
    await db.insert(schema.users).values({
      id: userId,
      email,
      password,
    });
    
    const token = jwt.sign(
      { userId, email },
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
    
    return res.status(201).json({
      isSuccess: true,
      message: "User created successfully",
      data: { userId, email },
    });
  } catch (error) {
    return res.status(500).json({
      isSuccess: false,
      message: "Internal server error",
      error: error,
    });
  }
};

export default Signup;
