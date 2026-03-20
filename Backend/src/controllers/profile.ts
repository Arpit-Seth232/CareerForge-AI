import { Response } from "express";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { IRequest } from "../middleware/authMiddleware";
import { catchAsync } from "../utils/catchAsync";
import { AuthenticationError, ValidationError } from "../errors/AppError";

const jobSeekerProfileDetails = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const {
    fullName,
    bio,
    yearOfExp,
    currentTitle,
    experienceLevel,
    rolePreference,
    linkedinUrl,
    githubUrl,
    phone,
    claimedLocation,
    workTypePref,
    salaryExpMin,
    salaryExpMax,
    willingToRelocate,
  } = req.body;

  if (!fullName) {
    throw new ValidationError("fullName is required");
  }

  const profileData = {
    fullName,
    bio: bio || null,
    yearOfExp: yearOfExp != null ? Number(yearOfExp) : 0,
    currentTitle: currentTitle || null,
    experienceLevel: experienceLevel || null,
    rolePreference: rolePreference || null,
    linkedinUrl: linkedinUrl || null,
    githubUrl: githubUrl || null,
    phone: phone || null,
    claimedLocation: claimedLocation || null,
    workTypePref: workTypePref || null,
    salaryExpMin: salaryExpMin || null,
    salaryExpMax: salaryExpMax || null,
    willingToRelocate: willingToRelocate ?? false,
  };

  const [existing] = await db
    .select({ id: schema.jobSeekerProfiles.id })
    .from(schema.jobSeekerProfiles)
    .where(eq(schema.jobSeekerProfiles.userId, req.userId));

  if (existing) {
    await db
      .update(schema.jobSeekerProfiles)
      .set(profileData)
      .where(eq(schema.jobSeekerProfiles.userId, req.userId));
  } else {
    await db
      .insert(schema.jobSeekerProfiles)
      .values({ userId: req.userId, ...profileData });
  }

  res.status(200).json({
    isSuccess: true,
    message: "Profile updated successfully",
  });
});

const recruiterProfileDetails = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const {
    fullName,
    position,
    jobLocation,
    phone,
    companyName,
    companyWebsite,
    companyIndustry,
    companySize,
    companyHqLocation,
    companyDescription,
    companyLinkedinUrl,
  } = req.body;

  if (!fullName || !position) {
    throw new ValidationError("fullName and position are required");
  }

  let companyId: string | null = null;

  if (companyName) {
    const [existingCompany] = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(eq(schema.companies.name, companyName));

    if (existingCompany) {
      companyId = existingCompany.id;
      await db
        .update(schema.companies)
        .set({
          website: companyWebsite || null,
          industry: companyIndustry || null,
          companySize: companySize || null,
          hqLocation: companyHqLocation || null,
          description: companyDescription || null,
          linkedinUrl: companyLinkedinUrl || null,
        })
        .where(eq(schema.companies.id, companyId));
    } else {
      const [newCompany] = await db
        .insert(schema.companies)
        .values({
          name: companyName,
          website: companyWebsite || null,
          industry: companyIndustry || null,
          companySize: companySize || null,
          hqLocation: companyHqLocation || null,
          description: companyDescription || null,
          linkedinUrl: companyLinkedinUrl || null,
        })
        .returning({ id: schema.companies.id });
      companyId = newCompany.id;
    }
  }

  const profileData = {
    fullName,
    position,
    jobLocation: jobLocation || null,
    phone: phone || null,
    companyId,
  };

  const [existing] = await db
    .select({ id: schema.recruiterProfiles.id })
    .from(schema.recruiterProfiles)
    .where(eq(schema.recruiterProfiles.userId, req.userId));

  if (existing) {
    await db
      .update(schema.recruiterProfiles)
      .set(profileData)
      .where(eq(schema.recruiterProfiles.userId, req.userId));
  } else {
    await db
      .insert(schema.recruiterProfiles)
      .values({ userId: req.userId, ...profileData });
  }

  res.status(200).json({
    isSuccess: true,
    message: "Profile updated successfully",
  });
});

const mentorProfileDetails = catchAsync(async (req: IRequest, res: Response) => {
  if (!req.userId) throw new AuthenticationError();

  const {
    fullName,
    title,
    company,
    yearsOfExp,
    expertiseAreas,
    phone,
    linkedinUrl,
    pricePerSession,
  } = req.body;

  if (!fullName || !expertiseAreas || yearsOfExp === undefined) {
    throw new ValidationError("fullName, expertiseAreas, and yearsOfExp are required");
  }

  const expertiseArray = Array.isArray(expertiseAreas) ? expertiseAreas : [expertiseAreas];

  const profileData = {
    fullName,
    title: title || null,
    company: company || null,
    yearsOfExp: Number(yearsOfExp),
    expertiseAreas: expertiseArray,
    phone: phone || null,
    linkedinUrl: linkedinUrl || null,
    pricePerSession: pricePerSession || null,
  };

  const [existing] = await db
    .select({ id: schema.mentorProfiles.id })
    .from(schema.mentorProfiles)
    .where(eq(schema.mentorProfiles.userId, req.userId));

  if (existing) {
    await db
      .update(schema.mentorProfiles)
      .set(profileData)
      .where(eq(schema.mentorProfiles.userId, req.userId));
  } else {
    await db
      .insert(schema.mentorProfiles)
      .values({ userId: req.userId, ...profileData });
  }

  res.status(200).json({
    isSuccess: true,
    message: "Profile updated successfully",
  });
});

export {
  jobSeekerProfileDetails,
  recruiterProfileDetails,
  mentorProfileDetails,
};
