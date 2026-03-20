import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { getRoadmaps, getRoadmapById, updateMilestoneStatus } from "../controllers/roadmap";

const router = Router();

router.get("/", authMiddleware, getRoadmaps);
router.get("/:id", authMiddleware, getRoadmapById);
router.patch("/milestone/:id", authMiddleware, updateMilestoneStatus);

export default router;
