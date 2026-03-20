import { Response } from "express";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, and, desc, sql, ilike, or, count } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../errors/AppError";

const createJob = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const {
    jobTitle,
    jobDescription,
    jobRequirement,
    minExperience,
    maxExperience,
    minSalary,
    maxSalary,
    jobLocation,
    jobType,
    workType,
    openSlots,
    skills,
  } = req.body;

  if (!jobTitle || !jobDescription) {
    throw new ValidationError("jobTitle and jobDescription are required");
  }

  const validJobTypes = ["full_time", "part_time", "contract", "internship"];
  if (jobType && !validJobTypes.includes(jobType)) {
    throw new ValidationError("Invalid jobType");
  }

  const validWorkTypes = ["remote", "hybrid", "onsite"];
  if (workType && !validWorkTypes.includes(workType)) {
    throw new ValidationError("Invalid workType");
  }

  const [recruiterProfile] = await db
    .select({ companyId: schema.recruiterProfiles.companyId })
    .from(schema.recruiterProfiles)
    .where(eq(schema.recruiterProfiles.userId, req.userId));

  const [job] = await db
    .insert(schema.jobs)
    .values({
      recruiterId: req.userId,
      companyId: recruiterProfile?.companyId || null,
      jobTitle,
      jobDescription,
      jobRequirement: jobRequirement || null,
      minExperience: minExperience != null ? Number(minExperience) : 0,
      maxExperience: maxExperience != null ? Number(maxExperience) : null,
      minSalary: minSalary || null,
      maxSalary: maxSalary || null,
      jobLocation: jobLocation || null,
      jobType: jobType || null,
      workType: workType || null,
      openSlots: openSlots != null ? Number(openSlots) : 1,
    })
    .returning();

  if (skills && Array.isArray(skills) && skills.length > 0) {
    for (const skillName of skills) {
      let [existing] = await db
        .select({ id: schema.skillsMaster.id })
        .from(schema.skillsMaster)
        .where(eq(schema.skillsMaster.name, skillName));

      if (!existing) {
        [existing] = await db
          .insert(schema.skillsMaster)
          .values({ name: skillName })
          .returning({ id: schema.skillsMaster.id });
      }

      await db.insert(schema.jobSkills).values({
        jobId: job.id,
        skillId: existing.id,
      });
    }
  }

  res.status(201).json({
    isSuccess: true,
    message: "Job posted successfully",
    data: job,
  });
});

const getMyJobs = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const conditions = [eq(schema.jobs.recruiterId, req.userId)];

  if (status === "active") conditions.push(eq(schema.jobs.isActive, true));
  if (status === "paused") conditions.push(eq(schema.jobs.isActive, false));

  if (search) {
    conditions.push(
      or(
        ilike(schema.jobs.jobTitle, `%${search}%`),
        ilike(schema.jobs.jobDescription, `%${search}%`),
      )!,
    );
  }

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
      isActive: schema.jobs.isActive,
      openSlots: schema.jobs.openSlots,
      createdAt: schema.jobs.createdAt,
      updatedAt: schema.jobs.updatedAt,
      expiresAt: schema.jobs.expiresAt,
      companyName: schema.companies.name,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(and(...conditions))
    .orderBy(desc(schema.jobs.createdAt));

  const jobIds = jobRows.map((j) => j.id);
  let applicationCounts: Record<string, number> = {};

  if (jobIds.length > 0) {
    const appRows = await db
      .select({
        jobId: schema.applications.jobId,
        count: count(),
      })
      .from(schema.applications)
      .where(
        sql`${schema.applications.jobId} IN (${sql.join(
          jobIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(schema.applications.jobId);

    for (const row of appRows) {
      applicationCounts[row.jobId] = Number(row.count);
    }
  }

  const jobsWithCounts = jobRows.map((job) => ({
    ...job,
    applicationCount: applicationCounts[job.id] || 0,
  }));

  res.status(200).json({
    isSuccess: true,
    message: "Jobs retrieved successfully",
    data: jobsWithCounts,
  });
});

const getJobById = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, id), eq(schema.jobs.recruiterId, req.userId)));

  if (!job) throw new NotFoundError("Job not found");

  const skills = await db
    .select({
      id: schema.skillsMaster.id,
      name: schema.skillsMaster.name,
    })
    .from(schema.jobSkills)
    .innerJoin(
      schema.skillsMaster,
      eq(schema.jobSkills.skillId, schema.skillsMaster.id),
    )
    .where(eq(schema.jobSkills.jobId, id));

  const [appCount] = await db
    .select({ count: count() })
    .from(schema.applications)
    .where(eq(schema.applications.jobId, id));

  res.status(200).json({
    isSuccess: true,
    message: "Job retrieved successfully",
    data: {
      ...job,
      skills: skills.map((s) => s.name),
      applicationCount: Number(appCount.count),
    },
  });
});

const updateJob = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [existing] = await db
    .select({ id: schema.jobs.id, recruiterId: schema.jobs.recruiterId })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id));

  if (!existing) throw new NotFoundError("Job not found");
  if (existing.recruiterId !== req.userId) {
    throw new ForbiddenError("You can only edit your own jobs");
  }

  const {
    jobTitle,
    jobDescription,
    jobRequirement,
    minExperience,
    maxExperience,
    minSalary,
    maxSalary,
    jobLocation,
    jobType,
    workType,
    openSlots,
    skills,
  } = req.body;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
  if (jobDescription !== undefined) updateData.jobDescription = jobDescription;
  if (jobRequirement !== undefined)
    updateData.jobRequirement = jobRequirement || null;
  if (minExperience !== undefined)
    updateData.minExperience = Number(minExperience);
  if (maxExperience !== undefined)
    updateData.maxExperience = maxExperience != null ? Number(maxExperience) : null;
  if (minSalary !== undefined) updateData.minSalary = minSalary || null;
  if (maxSalary !== undefined) updateData.maxSalary = maxSalary || null;
  if (jobLocation !== undefined) updateData.jobLocation = jobLocation || null;
  if (jobType !== undefined) updateData.jobType = jobType || null;
  if (workType !== undefined) updateData.workType = workType || null;
  if (openSlots !== undefined) updateData.openSlots = Number(openSlots);

  await db.update(schema.jobs).set(updateData).where(eq(schema.jobs.id, id));

  if (skills && Array.isArray(skills)) {
    await db.delete(schema.jobSkills).where(eq(schema.jobSkills.jobId, id));

    for (const skillName of skills) {
      let [sk] = await db
        .select({ id: schema.skillsMaster.id })
        .from(schema.skillsMaster)
        .where(eq(schema.skillsMaster.name, skillName));

      if (!sk) {
        [sk] = await db
          .insert(schema.skillsMaster)
          .values({ name: skillName })
          .returning({ id: schema.skillsMaster.id });
      }

      await db.insert(schema.jobSkills).values({
        jobId: id,
        skillId: sk.id,
      });
    }
  }

  res.status(200).json({
    isSuccess: true,
    message: "Job updated successfully",
  });
});

const toggleJobActive = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [job] = await db
    .select({
      id: schema.jobs.id,
      recruiterId: schema.jobs.recruiterId,
      isActive: schema.jobs.isActive,
    })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id));

  if (!job) throw new NotFoundError("Job not found");
  if (job.recruiterId !== req.userId) {
    throw new ForbiddenError("You can only modify your own jobs");
  }

  const newStatus = !job.isActive;

  await db
    .update(schema.jobs)
    .set({ isActive: newStatus, updatedAt: new Date() })
    .where(eq(schema.jobs.id, id));

  res.status(200).json({
    isSuccess: true,
    message: `Job ${newStatus ? "activated" : "paused"} successfully`,
    data: { isActive: newStatus },
  });
});

const deleteJob = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [job] = await db
    .select({ id: schema.jobs.id, recruiterId: schema.jobs.recruiterId })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id));

  if (!job) throw new NotFoundError("Job not found");
  if (job.recruiterId !== req.userId) {
    throw new ForbiddenError("You can only delete your own jobs");
  }

  await db.delete(schema.jobSkills).where(eq(schema.jobSkills.jobId, id));
  await db.delete(schema.jobs).where(eq(schema.jobs.id, id));

  res.status(200).json({
    isSuccess: true,
    message: "Job deleted successfully",
  });
});

export {
  createJob,
  getMyJobs,
  getJobById,
  updateJob,
  toggleJobActive,
  deleteJob,
};
