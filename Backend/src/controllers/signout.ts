import { Request, Response } from "express";

const Signout = async (req: Request, res: Response) => {
  try {
    // Clear the JWT token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    return res.status(200).json({
      isSuccess: true,
      message: "User signed out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      isSuccess: false,
      message: "Internal server error",
      error: error,
    });
  }
};

export default Signout;
