import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  createJob,
  getMyJobs,
  getJobById,
  updateJob,
  toggleJobActive,
  deleteJob,
} from "../controllers/jobs";

const router = Router();

router.post("/", authMiddleware, createJob);
router.get("/", authMiddleware, getMyJobs);
router.get("/:id", authMiddleware, getJobById);
router.put("/:id", authMiddleware, updateJob);
router.patch("/:id/toggle", authMiddleware, toggleJobActive);
router.delete("/:id", authMiddleware, deleteJob);

export default router;
