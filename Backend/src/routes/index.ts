import { Router } from "express";
import authRouter from "./auth.js";
import resumeRouter from "./resume.js";
import roadmapRouter from "./roadmap.js";
import jobsRouter from "./jobs.js";
import jobFeedRouter from "./jobFeed.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/resume", resumeRouter);
router.use("/roadmap", roadmapRouter);
router.use("/jobs", jobsRouter);
router.use("/job-feed", jobFeedRouter);

export default router;
