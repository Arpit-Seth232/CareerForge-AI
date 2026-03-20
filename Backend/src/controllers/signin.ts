import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { authenticateUser, getCookieOptions } from "../services/auth.service";

const Signin = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { token, userId, email: userEmail } = await authenticateUser(email, password);

  res.cookie("token", token, getCookieOptions());

  res.status(200).json({
    isSuccess: true,
    message: "Signed in successfully",
    data: { userId, email: userEmail },
  });
});

export default Signin;
