import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { getUserResumes, setPrimaryResume } from "../controllers/resume";

const router = Router();

router.get("/", authMiddleware, getUserResumes);
router.patch("/:id/primary", authMiddleware, setPrimaryResume);

export default router;
