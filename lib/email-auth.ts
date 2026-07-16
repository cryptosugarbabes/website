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

function mailer() {
  const host = process.env.EMAIL_SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASSWORD;
  if (!user || !pass) throw new Error("EMAIL_SMTP_NOT_CONFIGURED");

  return {
    from: process.env.EMAIL_FROM || `Crypto Sugar Babes <${user}>`,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    })
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailFrame(content: string) {
  return `<div style="margin:0;background:#12090f;color:#f7edf2;padding:36px 20px;font-family:Arial,sans-serif;line-height:1.6"><div style="max-width:580px;margin:0 auto;border:1px solid #3b2633;border-radius:18px;background:#1a1017;padding:32px"><p style="margin:0 0 22px;color:#e0ba78;font-size:12px;letter-spacing:3px;text-transform:uppercase">Crypto Sugar Babes</p>${content}<p style="margin:28px 0 0;color:#88747f;font-size:12px">If you did not create or update this account, contact <a href="mailto:email@cryptosugarbabes.com" style="color:#e0ba78">email@cryptosugarbabes.com</a>.</p></div></div>`;
}

async function sendEmail(to: string, subject: string, text: string, content: string) {
  const { from, transport } = mailer();
  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: emailFrame(content)
  });
}

export async function sendSignInCode(email: string, code: string) {
  await sendEmail(
    email,
    "Your Crypto Sugar Babes sign-in code",
    `Your sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    `<h1 style="margin:0 0 15px;font-family:Georgia,serif;font-size:28px;font-weight:500">Confirm your email</h1><p style="color:#c8b8c0">Your one-time sign-in code is:</p><p style="margin:20px 0;font-size:34px;letter-spacing:8px;font-weight:700;color:#f29ac2">${code}</p><p style="color:#baa8b0">It expires in 10 minutes. Entering this code verifies your email and signs you in.</p>`
  );
}

export async function sendWelcomeEmail(email: string) {
  await sendEmail(
    email,
    "Welcome to Crypto Sugar Babes",
    "Your email has been verified and your Crypto Sugar Babes membership is ready. You can create a profile and message for free. Connect a wallet only when you want to send or receive paid likes, gifts or boosts.",
    `<h1 style="margin:0 0 15px;font-family:Georgia,serif;font-size:30px;font-weight:500">Welcome. Your email is verified.</h1><p style="color:#c8b8c0">Your membership is ready. You can create a profile and message for free.</p><p style="color:#c8b8c0">Connect a Base or Solana wallet only when you want to send or receive paid likes, gifts or boosted messages.</p><a href="https://cryptosugarbabes.com/dashboard" style="display:inline-block;margin-top:14px;border-radius:999px;background:#e0ba78;color:#160d13;padding:13px 22px;text-decoration:none;font-weight:700">Open your dashboard</a>`
  );
}

export async function sendProfileReviewEmail(email: string, input: { approved: boolean; profileName?: string | null; reason?: string | null }) {
  const name = input.profileName?.trim() || "your profile";
  const safeName = escapeHtml(name);
  const reason = input.reason?.trim() || "Please review your profile and update the requested details.";
  if (input.approved) {
    await sendEmail(
      email,
      "Your Crypto Sugar Babes profile is approved",
      `${name} has been approved and is now eligible to appear in discovery. You can manage it from your dashboard.`,
      `<h1 style="margin:0 0 15px;font-family:Georgia,serif;font-size:30px;font-weight:500">Your profile is approved.</h1><p style="color:#c8b8c0"><strong>${safeName}</strong> has passed review and is now eligible to appear in discovery.</p><a href="https://cryptosugarbabes.com/dashboard" style="display:inline-block;margin-top:14px;border-radius:999px;background:#e0ba78;color:#160d13;padding:13px 22px;text-decoration:none;font-weight:700">Manage your profile</a>`
    );
    return;
  }
  await sendEmail(
    email,
    "Updates needed for your Crypto Sugar Babes profile",
    `${name} needs an update before it can be approved. Administrator note: ${reason}`,
    `<h1 style="margin:0 0 15px;font-family:Georgia,serif;font-size:30px;font-weight:500">Your profile needs an update.</h1><p style="color:#c8b8c0"><strong>${safeName}</strong> is not yet approved.</p><div style="margin:18px 0;padding:16px;border-left:3px solid #e0ba78;background:#21131c;color:#e9dce3"><strong>Review note</strong><br>${escapeHtml(reason)}</div><p style="color:#c8b8c0">Update your profile and submit it again when you are ready.</p><a href="https://cryptosugarbabes.com/dashboard" style="display:inline-block;margin-top:14px;border-radius:999px;background:#e0ba78;color:#160d13;padding:13px 22px;text-decoration:none;font-weight:700">Update your profile</a>`
  );
}

export async function sendNewMessageEmail(email: string, senderName?: string | null) {
  const name = (senderName?.trim() || "A member").replace(/[\r\n]+/g, " ");
  const safeName = escapeHtml(name);
  await sendEmail(
    email,
    `New private message from ${name}`,
    `${name} sent you a private message on Crypto Sugar Babes. Sign in to read and reply. For privacy, message contents are not included in email notifications.`,
    `<h1 style="margin:0 0 15px;font-family:Georgia,serif;font-size:30px;font-weight:500">You have a new private message.</h1><p style="color:#c8b8c0"><strong>${safeName}</strong> sent you a message on Crypto Sugar Babes.</p><p style="color:#8f7d87;font-size:13px">For privacy, the message itself is only shown inside your secure inbox.</p><a href="https://cryptosugarbabes.com/dashboard#messages" style="display:inline-block;margin-top:14px;border-radius:999px;background:#ff2f92;color:#fff;padding:13px 22px;text-decoration:none;font-weight:700">Open your inbox</a>`
  );
}
