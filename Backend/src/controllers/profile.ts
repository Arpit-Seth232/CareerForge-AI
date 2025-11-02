import { Request, Response } from "express";
import { db } from "../db";
import { schema } from "../db/schema";
import { eq } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";

const jobSeekerProfileDetails = async (req: IRequest, res: Response) => {
  const { fullName, bio, preferredRoles, yearOfExperience } =
    req.body;

  try {
    // Update user profile completion status
    if (!fullName || !preferredRoles || !yearOfExperience) {
      return res.status(400).json({
        isSuccess: false,
        message: "Please Enter all details",
      });
    }

    if (!req.userId) {
      return res.status(400).json({
        isSuccess: false,
        message: "User ID not found",
      });
    }

    // Ensure preferredRoles is an array
    const preferredRolesArray = Array.isArray(preferredRoles) ? preferredRoles : [preferredRoles];

    // Check if job seeker profile exists
    const existingProfile = await db
      .select()
      .from(schema.jobSeeker)
      .where(eq(schema.jobSeeker.id, req?.userId));

    let userData;
    if (existingProfile.length > 0) {
      // Update existing profile
      userData = await db
        .update(schema.jobSeeker)
        .set({
          fullName,
          bio,
          preferredRoles: preferredRolesArray,
          yearOfExperience,
        })
        .where(eq(schema.jobSeeker.id, req?.userId));
    } else {
      // Insert new profile
      userData = await db
        .insert(schema.jobSeeker)
        .values({
          id: req?.userId,
          fullName,
          bio,
          preferredRoles: preferredRolesArray,
          yearOfExperience,
        });
        // Update user profile completion status
        await db
          .update(schema.users)
          .set({ isProfileCompleted: true })
          .where(eq(schema.users.id, req?.userId));
    }


    return res.status(200).json({
      isSuccess: true,
      message: "Profile completion status updated successfully",
      data: userData,
    });
  } catch (error) {
    console.error("Error updating profile completion:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const recruiterProfileDetails = async (req: IRequest, res: Response) => {
  const { fullName, companyName, jobTitle, companySize, industry } = req.body;

  try {
    // Update recruiter profile completion status
    if (!fullName || !companyName || !jobTitle || !companySize || !industry) {
      return res.status(400).json({
        isSuccess: false,
        message: "Please Enter all details",
      });
    }

    if (!req.userId) {
      return res.status(400).json({
        isSuccess: false,
        message: "User ID not found",
      });
    }

    // Check if recruiter profile exists
    const existingProfile = await db
      .select()
      .from(schema.recruiter)
      .where(eq(schema.recruiter.id, req?.userId));

    let userData;
    if (existingProfile.length > 0) {
      // Update existing profile
      userData = await db
        .update(schema.recruiter)
        .set({
          companyName,
          fullName,
          jobTitle,
          companySize,
          industry,
        })
        .where(eq(schema.recruiter.id, req?.userId));
    } else {
      // Insert new profile
      userData = await db
        .insert(schema.recruiter)
        .values({
          id: req?.userId,
          companyName,
          fullName,
          jobTitle,
          companySize,
          industry,
        });
        // Update user profile completion status
        await db
          .update(schema.users)
          .set({ isProfileCompleted: true })
          .where(eq(schema.users.id, req?.userId));
    }


    return res.status(200).json({
      isSuccess: true,
      message: "Profile completion status updated successfully",
      data: userData,
    });
  } catch (error) {
    console.error("Error updating profile completion:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const mentorProfileDetails = async (req: IRequest, res: Response) => {
  const { fullName, expertise, yearOfMentoring, bio } = req.body;

  try {
    // Update mentor profile completion status
    if (!fullName || !expertise || !yearOfMentoring || !bio) {
      return res.status(400).json({
        isSuccess: false,
        message: "Please Enter all details",
      });
    }

    if (!req.userId) {
      return res.status(400).json({
        isSuccess: false,
        message: "User ID not found",
      });
    }

    // Ensure expertise is an array
    const expertiseArray = Array.isArray(expertise) ? expertise : [expertise];

    // Check if mentor profile exists
    const existingProfile = await db
      .select()
      .from(schema.mentors)
      .where(eq(schema.mentors.id, req?.userId));

    let userData;
    if (existingProfile.length > 0) {
      // Update existing profile
      userData = await db
        .update(schema.mentors)
        .set({
          fullName,
          expertise: expertiseArray,
          yearOfMentoring,
          bio,
        })
        .where(eq(schema.mentors.id, req?.userId));
    } else {
      // Insert new profile
      userData = await db
        .insert(schema.mentors)
        .values({
          id: req?.userId,
          fullName,
          expertise: expertiseArray,
          yearOfMentoring,
          bio,
        });
        // Update user profile completion status
        await db
          .update(schema.users)
          .set({ isProfileCompleted: true })
          .where(eq(schema.users.id, req?.userId));
    }


    return res.status(200).json({
      isSuccess: true,
      message: "Profile completion status updated successfully",
      data: userData,
    });
  } catch (error) {
    console.error("Error updating profile completion:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export {
  jobSeekerProfileDetails,
  recruiterProfileDetails,
  mentorProfileDetails,
};
