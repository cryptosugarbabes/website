import { createHmac, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function emailCodeHash(challengeId: string, email: string, code: string) {
  const secret = process.env.AUTH_SECRET || "velora-local-development-secret-change-before-deploy";
  return createHmac("sha256", secret).update(`${challengeId}:${email}:${code}`).digest("hex");
}

export function safeHashEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function sendSignInCode(email: string, code: string) {
  const host = process.env.EMAIL_SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASSWORD;
  if (!user || !pass) throw new Error("EMAIL_SMTP_NOT_CONFIGURED");

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM || `Crypto Sugar Babes <${user}>`,
    to: email,
    subject: "Your Crypto Sugar Babes sign-in code",
    text: `Your sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<div style="background:#12090f;color:#f7edf2;padding:32px;font-family:Arial,sans-serif"><h1 style="font-size:22px">Crypto Sugar Babes</h1><p>Your one-time sign-in code is:</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#f29ac2">${code}</p><p style="color:#baa8b0">It expires in 10 minutes. If you did not request this code, you can ignore this email.</p></div>`
  });
}
