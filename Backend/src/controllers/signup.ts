import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { registerUser } from "../services/auth.service";

const Signup = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await registerUser(email, password);

  res.status(201).json({
    isSuccess: true,
    message: "Account created. Please check your email to verify.",
    data: result,
  });
});

export default Signup;
