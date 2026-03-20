import { z } from "zod";

export const signupSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const roleSchema = z.object({
  role: z.enum(["job_seeker", "recruiter", "mentor"], {
    message: "Please select a valid role",
  }),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
});
