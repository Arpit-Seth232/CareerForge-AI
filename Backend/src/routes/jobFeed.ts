import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  scrapeJobs,
  getJobFeed,
  toggleSaveJob,
  getSavedJobs,
} from "../controllers/jobScraper";

const router = Router();

// Admin: trigger scraping
router.post("/scrape", authMiddleware, scrapeJobs);

// Jobseeker: browse jobs
router.get("/feed", authMiddleware, getJobFeed);

// Jobseeker: save/unsave
router.post("/save/:id", authMiddleware, toggleSaveJob);

// Jobseeker: get saved jobs
router.get("/saved", authMiddleware, getSavedJobs);

export default router;
