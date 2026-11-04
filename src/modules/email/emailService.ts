import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.BREVO_SMTP_HOST,
      port: env.BREVO_SMTP_PORT,
      secure: false, // 587 uses STARTTLS
      auth: {
        user: env.BREVO_SMTP_USER,
        pass: env.BREVO_SMTP_KEY
      }
    });
  }
  return transporter;
}

export async function sendOtpEmail(toEmail: string, otpCode: string, userName: string = 'User'): Promise<boolean> {
  try {
    const mailClient = getTransporter();

    const mailOptions = {
      from: `"${env.BREVO_FROM_NAME}" <${env.BREVO_FROM_EMAIL}>`,
      to: toEmail,
      subject: `Archon Nell - Your 2FA Verification Code: ${otpCode}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0b1b3d; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.5px;">ARCHON NELL INCORPORATED</h1>
            <p style="color: #94a3b8; font-size: 12px; margin: 6px 0 0;">Industrial Infrastructure & Materials Platform</p>
          </div>
          <div style="padding: 32px 28px;">
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px;">Two-Factor Authentication (2FA)</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              Hello <strong>${userName}</strong>, a sign-in attempt was initiated for your account. Please use the verification code below to complete your login:
            </p>
            <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; color: #1e40af; letter-spacing: 6px; display: inline-block;">
                ${otpCode}
              </span>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 16px;">
              ⏳ This verification code will expire in <strong>5 minutes</strong>. If you did not make this request, please change your password immediately or contact your administrator.
            </p>
            <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                &copy; 2026 Archon Nell Incorporated. All rights reserved. Centralized SSO Security.
              </p>
            </div>
          </div>
        </div>
      `
    };

    const info = await mailClient.sendMail(mailOptions);
    console.log(`[Email Service] OTP successfully dispatched to ${toEmail} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[Email Service] Failed to send OTP email to ${toEmail}:`, error.message);
    return false;
  }
}

export async function sendPasswordResetEmail(toEmail: string, resetCode: string, userName: string = 'User'): Promise<boolean> {
  try {
    const mailClient = getTransporter();

    const mailOptions = {
      from: `"${env.BREVO_FROM_NAME}" <${env.BREVO_FROM_EMAIL}>`,
      to: toEmail,
      subject: `Archon Nell - Password Reset Code: ${resetCode}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0b1b3d; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.5px;">ARCHON NELL INCORPORATED</h1>
            <p style="color: #94a3b8; font-size: 12px; margin: 6px 0 0;">Industrial Infrastructure & Materials Platform</p>
          </div>
          <div style="padding: 32px 28px;">
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px;">Password Reset Request</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              Hello <strong>${userName}</strong>, a password reset request was received for your account. Please enter the verification code below:
            </p>
            <div style="background-color: #fef2f2; border: 2px dashed #fca5a5; border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; color: #b91c1c; letter-spacing: 6px; display: inline-block;">
                ${resetCode}
              </span>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 16px;">
              ⏳ This code is valid for <strong>5 minutes</strong>. If you did not request a password reset, please ignore this email.
            </p>
            <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                &copy; 2026 Archon Nell Incorporated. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `
    };

    const info = await mailClient.sendMail(mailOptions);
    console.log(`[Email Service] Password reset code dispatched to ${toEmail} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[Email Service] Failed to send reset email to ${toEmail}:`, error.message);
    return false;
  }
}
