import nodemailer from "nodemailer";
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL } from "../config";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"CareerForge AI" <${SMTP_FROM}>`,
    to: email,
    subject: "Verify your email — CareerForge AI",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #6366f1;">Welcome to CareerForge AI</h2>
        <p>Thanks for signing up! Please verify your email address by clicking the button below.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 14px;">
          Or copy this link into your browser:<br/>
          <a href="${verifyUrl}">${verifyUrl}</a>
        </p>
        <p style="color: #888; font-size: 13px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
}
