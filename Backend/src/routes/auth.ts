import { Router } from "express";
import signup from "../controllers/signup";
import { jobSeekerProfileDetails, recruiterProfileDetails, mentorProfileDetails } from "../controllers/profile";
import authMiddleware from "../middleware/authMiddleware";
import role from "../controllers/role";
import signin from "../controllers/signin";
import signout from "../controllers/signout";
import me from "../controllers/me";
const router = Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/signout", signout);
router.get("/me", authMiddleware, me);
router.post("/roles", authMiddleware, role);
router.post("/job-seeker/profile", authMiddleware, jobSeekerProfileDetails);
router.post("/recruiter/profile", authMiddleware, recruiterProfileDetails);
router.post("/mentor/profile", authMiddleware, mentorProfileDetails);

export default router;
