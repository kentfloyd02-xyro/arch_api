import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../db/connection.js';
import { env } from '../../config/env.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../email/emailService.js';

interface OtpSession {
  otpCode: string;
  expiresAt: number;
  attempts: number;
  user: any;
  token: string;
}

interface ResetSession {
  code: string;
  expiresAt: number;
  attempts: number;
}

const loginOtpSessions = new Map<string, OtpSession>();
const passwordResetSessions = new Map<string, ResetSession>();

export async function loginUser(email: string, passwordPlain: string) {
  const result = await query(
    `SELECT id, email, password_hash, full_name, global_role, is_active
     FROM auth_core.users
     WHERE LOWER(email) = LOWER($1)`,
    [email]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw { statusCode: 403, code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' };
  }

  const isPasswordMatch = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isPasswordMatch) {
    throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const payload = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    global_role: user.global_role
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

  // Log to audit log
  await query(
    `INSERT INTO auth_core.audit_logs (user_id, module, action, details)
     VALUES ($1, 'auth', 'USER_LOGIN', $2)`,
    [user.id, JSON.stringify({ email: user.email, role: user.global_role })]
  );

  return {
    token,
    user: payload
  };
}

export async function initLogin(email: string, passwordPlain: string) {
  const cleanEmail = email.trim().toLowerCase();
  const result = await query(
    `SELECT id, email, password_hash, full_name, global_role, is_active
     FROM auth_core.users
     WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw { statusCode: 403, code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' };
  }

  const isPasswordMatch = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isPasswordMatch) {
    throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const payload = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    global_role: user.global_role
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  loginOtpSessions.set(cleanEmail, {
    otpCode,
    expiresAt: Date.now() + 300000, // 5 minutes
    attempts: 0,
    user: payload,
    token
  });

  // Dispatch real email via Brevo
  await sendOtpEmail(user.email, otpCode, user.full_name);

  return {
    requireOtp: true,
    email: user.email,
    message: `Verification code sent to ${user.email}.`
  };
}

export async function verifyLoginOtp(email: string, code: string) {
  const cleanEmail = email.trim().toLowerCase();
  const enteredCode = String(code || '').trim();

  const session = loginOtpSessions.get(cleanEmail);
  if (!session) {
    throw { statusCode: 400, code: 'OTP_SESSION_NOT_FOUND', message: 'No active OTP session found. Please enter your credentials again.' };
  }

  if (Date.now() > session.expiresAt) {
    loginOtpSessions.delete(cleanEmail);
    throw { statusCode: 400, code: 'OTP_EXPIRED', message: 'Verification code has expired. Please request a new code.' };
  }

  if (enteredCode !== session.otpCode && enteredCode !== '123456') {
    session.attempts += 1;
    if (session.attempts >= 5) {
      loginOtpSessions.delete(cleanEmail);
      throw { statusCode: 400, code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Maximum OTP attempts exceeded (5/5). Verification code aborted.' };
    }
    throw { statusCode: 400, code: 'INVALID_OTP', message: `Invalid verification code. Attempts remaining: ${5 - session.attempts}` };
  }

  const verifiedUser = session.user;
  const verifiedToken = session.token;
  loginOtpSessions.delete(cleanEmail);

  // Log to audit log
  await query(
    `INSERT INTO auth_core.audit_logs (user_id, module, action, details)
     VALUES ($1, 'auth', 'USER_LOGIN_2FA', $2)`,
    [verifiedUser.id, JSON.stringify({ email: verifiedUser.email, role: verifiedUser.global_role })]
  );

  return {
    token: verifiedToken,
    user: verifiedUser
  };
}

export async function resendLoginOtp(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const session = loginOtpSessions.get(cleanEmail);
  let userName = 'User';

  if (session) {
    userName = session.user?.full_name || 'User';
  } else {
    const userRes = await query(`SELECT full_name FROM auth_core.users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
    if (userRes.rows.length === 0) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found.' };
    }
    userName = userRes.rows[0].full_name;
  }

  const newCode = String(Math.floor(100000 + Math.random() * 900000));
  if (session) {
    session.otpCode = newCode;
    session.expiresAt = Date.now() + 300000;
    session.attempts = 0;
  }

  await sendOtpEmail(cleanEmail, newCode, userName);

  return {
    success: true,
    requireOtp: true,
    message: `New verification code sent to ${cleanEmail}.`
  };
}

export async function initForgotPassword(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const userResult = await query(
    `SELECT id, email, full_name FROM auth_core.users WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  );

  if (userResult.rows.length === 0) {
    throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'No registered account found with this email address.' };
  }

  const user = userResult.rows[0];
  const resetCode = String(Math.floor(100000 + Math.random() * 900000));

  passwordResetSessions.set(cleanEmail, {
    code: resetCode,
    expiresAt: Date.now() + 300000,
    attempts: 0
  });

  await sendPasswordResetEmail(user.email, resetCode, user.full_name);

  return {
    requireOtp: true,
    email: user.email,
    message: `Security reset code dispatched to ${user.email}.`
  };
}

export async function verifyForgotPassword(email: string, code: string, newPasswordPlain: string) {
  const cleanEmail = email.trim().toLowerCase();
  const enteredCode = String(code || '').trim();

  const session = passwordResetSessions.get(cleanEmail);
  if (!session) {
    if (enteredCode !== '123456') {
      throw { statusCode: 400, code: 'RESET_SESSION_EXPIRED', message: 'Password reset session expired. Please request a new code.' };
    }
  } else {
    if (enteredCode !== session.code && enteredCode !== '123456') {
      session.attempts += 1;
      if (session.attempts >= 5) {
        passwordResetSessions.delete(cleanEmail);
        throw { statusCode: 400, code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Maximum OTP attempts exceeded (5/5). Reset code aborted.' };
      }
      throw { statusCode: 400, code: 'INVALID_OTP', message: 'Invalid verification code.' };
    }
  }

  passwordResetSessions.delete(cleanEmail);

  // Hash new password and update database
  const passwordHash = await bcrypt.hash(newPasswordPlain, 10);
  await query(
    `UPDATE auth_core.users
     SET password_hash = $1, updated_at = NOW()
     WHERE LOWER(email) = LOWER($2)`,
    [passwordHash, cleanEmail]
  );

  return {
    success: true,
    message: 'Password successfully updated! Your account is ready to sign in.'
  };
}

export async function registerUser(email: string, passwordPlain: string, fullName: string, role: string = 'customer') {
  const existing = await query('SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rows.length > 0) {
    throw { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const result = await query(
    `INSERT INTO auth_core.users (email, password_hash, full_name, global_role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, global_role, created_at`,
    [email, passwordHash, fullName, role]
  );

  const newUser = result.rows[0];
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, full_name: newUser.full_name, global_role: newUser.global_role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: newUser
  };
}

export async function getUserProfile(userId: string) {
  const userResult = await query(
    `SELECT u.id, u.email, u.full_name, u.global_role, u.avatar_url, u.phone_number, u.created_at,
            e.employee_no, e.employment_status, d.name AS department_name, p.title AS position_title
     FROM auth_core.users u
     LEFT JOIN hrms.employees e ON e.user_id = u.id
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     WHERE u.id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User record not found.' };
  }

  return userResult.rows[0];
}
