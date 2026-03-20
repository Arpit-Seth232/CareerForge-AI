import { Response } from "express";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import { AuthenticationError, NotFoundError, ValidationError } from "../errors/AppError";

const getRoadmaps = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const roadmaps = await db
    .select()
    .from(schema.careerRoadmaps)
    .where(eq(schema.careerRoadmaps.jobSeekerId, req.userId))
    .orderBy(desc(schema.careerRoadmaps.createdAt));

  res.status(200).json({
    isSuccess: true,
    message: "Roadmaps retrieved successfully",
    data: roadmaps,
  });
});

const getRoadmapById = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;

  const [roadmap] = await db
    .select()
    .from(schema.careerRoadmaps)
    .where(
      and(
        eq(schema.careerRoadmaps.id, id),
        eq(schema.careerRoadmaps.jobSeekerId, req.userId),
      ),
    );

  if (!roadmap) throw new NotFoundError("Roadmap not found");

  const milestones = await db
    .select()
    .from(schema.roadmapMilestones)
    .where(eq(schema.roadmapMilestones.roadmapId, id))
    .orderBy(asc(schema.roadmapMilestones.orderIndex));

  res.status(200).json({
    isSuccess: true,
    message: "Roadmap retrieved successfully",
    data: { ...roadmap, milestones },
  });
});

const updateMilestoneStatus = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "in_progress", "completed"];
  if (!status || !validStatuses.includes(status)) {
    throw new ValidationError("Invalid status. Must be pending, in_progress, or completed");
  }

  const [milestone] = await db
    .select({
      milestoneId: schema.roadmapMilestones.id,
      roadmapId: schema.roadmapMilestones.roadmapId,
    })
    .from(schema.roadmapMilestones)
    .innerJoin(
      schema.careerRoadmaps,
      eq(schema.roadmapMilestones.roadmapId, schema.careerRoadmaps.id),
    )
    .where(
      and(
        eq(schema.roadmapMilestones.id, id),
        eq(schema.careerRoadmaps.jobSeekerId, req.userId),
      ),
    );

  if (!milestone) throw new NotFoundError("Milestone not found");

  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
  }

  await db
    .update(schema.roadmapMilestones)
    .set(updateData)
    .where(eq(schema.roadmapMilestones.id, id));

  if (status === "completed") {
    const completedRows = await db
      .select({ id: schema.roadmapMilestones.id })
      .from(schema.roadmapMilestones)
      .where(
        and(
          eq(schema.roadmapMilestones.roadmapId, milestone.roadmapId),
          eq(schema.roadmapMilestones.status, "completed"),
        ),
      );

    await db
      .update(schema.careerRoadmaps)
      .set({ currentMilestone: completedRows.length, updatedAt: new Date() })
      .where(eq(schema.careerRoadmaps.id, milestone.roadmapId));
  }

  res.status(200).json({
    isSuccess: true,
    message: `Milestone status updated to ${status}`,
  });
});

export { getRoadmaps, getRoadmapById, updateMilestoneStatus };
