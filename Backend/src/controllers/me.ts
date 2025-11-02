import { Response } from "express";
import { schema } from "../db/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";

const Me = async (req: IRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        isSuccess: false,
        message: "User not authenticated",
      });
    }

    // Get user information from database
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.userId));

    if (!user.length) {
      return res.status(404).json({
        isSuccess: false,
        message: "User not found",
      });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user[0];
    
    let roleSpecificData = null;

    // Fetch role-specific data based on user role
    if (userWithoutPassword.role === "jobseeker") {
      const jobSeekerData = await db
        .select()
        .from(schema.jobSeeker)
        .where(eq(schema.jobSeeker.id, req.userId));
      
      if (jobSeekerData.length > 0) {
        roleSpecificData = jobSeekerData[0];
      }
    } else if (userWithoutPassword.role === "recruiter") {
      const recruiterData = await db
        .select()
        .from(schema.recruiter)
        .where(eq(schema.recruiter.id, req.userId));
      
      if (recruiterData.length > 0) {
        roleSpecificData = recruiterData[0];
      }
    } else if (userWithoutPassword.role === "mentor") {
      const mentorData = await db
        .select()
        .from(schema.mentors)
        .where(eq(schema.mentors.id, req.userId));
      
      if (mentorData.length > 0) {
        roleSpecificData = mentorData[0];
      }
    }

    return res.status(200).json({
      isSuccess: true,
      message: "User information retrieved successfully",
      data: {
        ...userWithoutPassword,
        profile: roleSpecificData
      },
    });
  } catch (error) {
    console.error("Error fetching user info:", error);
    return res.status(500).json({
      isSuccess: false,
      message: "Internal server error",
      error: error,
    });
  }
};

export default Me;
