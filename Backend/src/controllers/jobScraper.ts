/**
 * Job Scraper Controller
 * - POST /scrape — trigger job scraping from JSearch
 * - GET /feed — get matched jobs for jobseekers (semantic + keyword)
 */

import { Response } from "express";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import {
  AuthenticationError,
  ValidationError,
} from "../errors/AppError";
import { scrapeAndStoreJobs, scrapeMultipleQueries } from "../services/jobScraper";
import { ML_API_URL } from "../config";

// ── POST /scrape — Admin triggers job scraping ─────────────────────

export const scrapeJobs = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { query, queries, location = "India", numPages = 1 } = req.body;

  if (!query && (!queries || !Array.isArray(queries) || queries.length === 0)) {
    throw new ValidationError("Provide 'query' (string) or 'queries' (string[])");
  }

  let result;
  if (queries && Array.isArray(queries)) {
    result = await scrapeMultipleQueries(queries, location);
    res.status(200).json({
      isSuccess: true,
      message: `Scraped ${result.totalStored} jobs from ${queries.length} queries`,
      data: result,
    });
  } else {
    result = await scrapeAndStoreJobs(query, location, numPages);
    res.status(200).json({
      isSuccess: true,
      message: `Scraped ${result.stored} new jobs`,
      data: result,
    });
  }
});

// ── GET /feed — Jobseeker job feed with matching ───────────────────

export const getJobFeed = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const search = req.query.search as string | undefined;
  const jobType = req.query.jobType as string | undefined;
  const workType = req.query.workType as string | undefined;
  const location = req.query.location as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const matchResume = req.query.match === "true";

  // If match=true, try semantic matching via ML service
  if (matchResume) {
    try {
      const matchResp = await fetch(`${ML_API_URL}/api/v1/jobs/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: req.userId,
          limit,
          offset,
          filters: { jobType, workType, location, search },
        }),
      });

      if (matchResp.ok) {
        const matchData = await matchResp.json();
        return res.status(200).json({
          isSuccess: true,
          message: "Matched jobs retrieved",
          data: matchData,
        });
      }
    } catch (err) {
      console.error("ML matching failed, falling back to DB query:", err);
    }
  }

  // Fallback: standard DB query with filters
  const conditions = [eq(schema.jobs.isActive, true)];

  if (search) {
    conditions.push(
      or(
        ilike(schema.jobs.jobTitle, `%${search}%`),
        ilike(schema.jobs.jobDescription, `%${search}%`),
      )!,
    );
  }

  if (jobType) conditions.push(eq(schema.jobs.jobType, jobType as any));
  if (workType) conditions.push(eq(schema.jobs.workType, workType as any));
  if (location) conditions.push(ilike(schema.jobs.jobLocation, `%${location}%`));

  const jobRows = await db
    .select({
      id: schema.jobs.id,
      jobTitle: schema.jobs.jobTitle,
      jobDescription: schema.jobs.jobDescription,
      jobRequirement: schema.jobs.jobRequirement,
      minExperience: schema.jobs.minExperience,
      maxExperience: schema.jobs.maxExperience,
      minSalary: schema.jobs.minSalary,
      maxSalary: schema.jobs.maxSalary,
      jobLocation: schema.jobs.jobLocation,
      jobType: schema.jobs.jobType,
      workType: schema.jobs.workType,
      openSlots: schema.jobs.openSlots,
      createdAt: schema.jobs.createdAt,
      expiresAt: schema.jobs.expiresAt,
      companyName: schema.companies.name,
      companyLogo: schema.companies.logoUrl,
      companyWebsite: schema.companies.website,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(and(...conditions))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(and(...conditions));

  // Fetch skills for each job
  const jobIds = jobRows.map((j) => j.id);
  let skillsMap: Record<string, string[]> = {};

  if (jobIds.length > 0) {
    const skillRows = await db
      .select({
        jobId: schema.jobSkills.jobId,
        skillName: schema.skillsMaster.name,
      })
      .from(schema.jobSkills)
      .innerJoin(schema.skillsMaster, eq(schema.jobSkills.skillId, schema.skillsMaster.id))
      .where(sql`${schema.jobSkills.jobId} IN (${sql.join(jobIds.map((id) => sql`${id}`), sql`, `)})`);

    for (const row of skillRows) {
      if (!skillsMap[row.jobId]) skillsMap[row.jobId] = [];
      skillsMap[row.jobId].push(row.skillName);
    }
  }

  // Check saved status for this user
  let savedSet = new Set<string>();
  if (jobIds.length > 0) {
    const savedRows = await db
      .select({ jobId: schema.savedJobs.jobId })
      .from(schema.savedJobs)
      .where(
        and(
          eq(schema.savedJobs.userId, req.userId),
          sql`${schema.savedJobs.jobId} IN (${sql.join(jobIds.map((id) => sql`${id}`), sql`, `)})`,
        ),
      );
    for (const row of savedRows) savedSet.add(row.jobId);
  }

  const jobs = jobRows.map((job) => ({
    ...job,
    skills: skillsMap[job.id] || [],
    isSaved: savedSet.has(job.id),
  }));

  res.status(200).json({
    isSuccess: true,
    message: "Jobs retrieved",
    data: {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// ── POST /save/:id — Save/unsave a job ─────────────────────────────

export const toggleSaveJob = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [existing] = await db
    .select({ id: schema.savedJobs.id })
    .from(schema.savedJobs)
    .where(
      and(eq(schema.savedJobs.userId, req.userId), eq(schema.savedJobs.jobId, id)),
    );

  if (existing) {
    await db.delete(schema.savedJobs).where(eq(schema.savedJobs.id, existing.id));
    res.status(200).json({ isSuccess: true, message: "Job unsaved", data: { isSaved: false } });
  } else {
    await db.insert(schema.savedJobs).values({ userId: req.userId, jobId: id });
    res.status(200).json({ isSuccess: true, message: "Job saved", data: { isSaved: true } });
  }
});

// ── GET /saved — Get saved jobs ────────────────────────────────────

export const getSavedJobs = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const savedRows = await db
    .select({
      id: schema.jobs.id,
      jobTitle: schema.jobs.jobTitle,
      jobDescription: schema.jobs.jobDescription,
      jobLocation: schema.jobs.jobLocation,
      jobType: schema.jobs.jobType,
      workType: schema.jobs.workType,
      minSalary: schema.jobs.minSalary,
      maxSalary: schema.jobs.maxSalary,
      minExperience: schema.jobs.minExperience,
      maxExperience: schema.jobs.maxExperience,
      createdAt: schema.jobs.createdAt,
      companyName: schema.companies.name,
      companyLogo: schema.companies.logoUrl,
      savedAt: schema.savedJobs.createdAt,
    })
    .from(schema.savedJobs)
    .innerJoin(schema.jobs, eq(schema.savedJobs.jobId, schema.jobs.id))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(eq(schema.savedJobs.userId, req.userId))
    .orderBy(desc(schema.savedJobs.createdAt));

  res.status(200).json({
    isSuccess: true,
    message: "Saved jobs retrieved",
    data: savedRows.map((j) => ({ ...j, isSaved: true })),
  });
});
