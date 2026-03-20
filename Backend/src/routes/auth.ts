import { Router } from "express";
import signup from "../controllers/signup";
import signin from "../controllers/signin";
import signout from "../controllers/signout";
import me from "../controllers/me";
import role from "../controllers/role";
import { verifyEmail, resendVerification, checkVerificationStatus } from "../controllers/verifyEmail";
import {
  jobSeekerProfileDetails,
  recruiterProfileDetails,
  mentorProfileDetails,
} from "../controllers/profile";
import { uploadAvatar } from "../controllers/avatar";
import authMiddleware from "../middleware/authMiddleware";
import express from "express";
import { validate } from "../middleware/validate";
import {
  signupSchema,
  signinSchema,
  roleSchema,
  resendVerificationSchema,
} from "../validators/auth.validator";

const router = Router();

// Public auth routes
router.post("/signup", validate(signupSchema), signup);
router.post("/signin", validate(signinSchema), signin);
router.post("/signout", signout);

// Email verification (public)
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", validate(resendVerificationSchema), resendVerification);
router.get("/verification-status", checkVerificationStatus);

// Protected routes
router.get("/me", authMiddleware, me);
router.post("/roles", authMiddleware, validate(roleSchema), role);
router.post("/job-seeker/profile", authMiddleware, jobSeekerProfileDetails);
router.post("/recruiter/profile", authMiddleware, recruiterProfileDetails);
router.post("/mentor/profile", authMiddleware, mentorProfileDetails);
router.patch("/job-seeker/profile", authMiddleware, jobSeekerProfileDetails);
router.patch("/recruiter/profile", authMiddleware, recruiterProfileDetails);
router.patch("/mentor/profile", authMiddleware, mentorProfileDetails);

// Avatar upload — accepts raw binary image body
router.post(
  "/avatar",
  authMiddleware,
  express.raw({ type: "image/*", limit: "2mb" }),
  uploadAvatar
);

export default router;
