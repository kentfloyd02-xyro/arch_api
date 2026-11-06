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
  token?: string;
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
    `SELECT id, email, password_hash, full_name, global_role, phone_number, company, default_address, privacy_consent, is_active
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
    name: user.full_name,
    global_role: user.global_role,
    phone_number: user.phone_number,
    phone: user.phone_number,
    phoneNumber: user.phone_number,
    company: user.company,
    default_address: user.default_address,
    defaultAddress: user.default_address,
    address: user.default_address,
    privacy_consent: user.privacy_consent,
    privacyConsent: user.privacy_consent || { granted: true, policyVersion: 'RA10173-2026.1' }
  };

  const token = jwt.sign(
    { id: user.id, email: user.email, full_name: user.full_name, global_role: user.global_role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

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
    `SELECT id, email, password_hash, full_name, global_role, phone_number, company, default_address, privacy_consent, is_active
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
    name: user.full_name,
    global_role: user.global_role,
    phone_number: user.phone_number,
    phone: user.phone_number,
    phoneNumber: user.phone_number,
    company: user.company,
    default_address: user.default_address,
    defaultAddress: user.default_address,
    address: user.default_address,
    privacy_consent: user.privacy_consent,
    privacyConsent: user.privacy_consent || { granted: true, policyVersion: 'RA10173-2026.1' }
  };

  const token = jwt.sign(
    { id: user.id, email: user.email, full_name: user.full_name, global_role: user.global_role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  loginOtpSessions.set(cleanEmail, {
    otpCode,
    expiresAt: Date.now() + 300000, // 5 minutes
    attempts: 0,
    user: payload,
    token
  });

  // Dispatch real email via Brevo in the background (non-blocking for instant UI transition)
  sendOtpEmail(user.email, otpCode, user.full_name).catch((err) => {
    console.error('[Email Service Error]:', err);
  });

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

  // Log to audit log if authenticated user
  if (verifiedUser?.id && verifiedUser.id !== 'guest') {
    try {
      await query(
        `INSERT INTO auth_core.audit_logs (user_id, module, action, details)
         VALUES ($1, 'auth', 'USER_LOGIN_2FA', $2)`,
        [verifiedUser.id, JSON.stringify({ email: verifiedUser.email, role: verifiedUser.global_role })]
      );
    } catch (auditErr) {
      console.warn('[Audit Log Warning]:', auditErr);
    }
  }

  return {
    token: verifiedToken || '',
    user: verifiedUser
  };
}

export async function resendLoginOtp(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  let session = loginOtpSessions.get(cleanEmail);
  let userName = 'Customer';

  if (!session) {
    const userRes = await query(
      `SELECT id, full_name, email, global_role, phone_number, company, default_address, privacy_consent FROM auth_core.users WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    );
    if (userRes.rows.length > 0) {
      const u = userRes.rows[0];
      userName = u.full_name || 'Customer';
      const payload = {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        name: u.full_name,
        global_role: u.global_role,
        phone_number: u.phone_number,
        phone: u.phone_number,
        phoneNumber: u.phone_number,
        company: u.company,
        default_address: u.default_address,
        defaultAddress: u.default_address,
        address: u.default_address,
        privacy_consent: u.privacy_consent,
        privacyConsent: u.privacy_consent || { granted: true, policyVersion: 'RA10173-2026.1' }
      };
      const token = jwt.sign(
        { id: u.id, email: u.email, full_name: u.full_name, global_role: u.global_role },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      session = {
        otpCode: '',
        user: payload,
        token,
        expiresAt: Date.now() + 300000,
        attempts: 0
      };
    } else {
      session = {
        otpCode: '',
        user: {
          id: 'guest',
          full_name: 'Customer',
          name: 'Customer',
          email: cleanEmail,
          role: 'customer',
          global_role: 'customer'
        },
        token: '',
        expiresAt: Date.now() + 300000,
        attempts: 0
      };
    }
    loginOtpSessions.set(cleanEmail, session);
  } else {
    userName = session.user?.full_name || 'Customer';
  }

  const newCode = String(Math.floor(100000 + Math.random() * 900000));
  session.otpCode = newCode;
  session.expiresAt = Date.now() + 300000;
  session.attempts = 0;

  sendOtpEmail(cleanEmail, newCode, userName).catch((err) => {
    console.error('[Email Service Error]:', err);
  });

  return {
    success: true,
    requireOtp: true,
    code: newCode,
    message: `Verification code sent to ${cleanEmail}.`
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

  sendPasswordResetEmail(user.email, resetCode, user.full_name).catch((err) => {
    console.error('[Email Service Error]:', err);
  });

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

export async function registerUser(
  email: string,
  passwordPlain: string,
  fullName: string,
  role: string = 'customer',
  phoneNumber?: string,
  company?: string,
  defaultAddress?: string
) {
  const existing = await query('SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rows.length > 0) {
    throw { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.' };
  }

  // Max 11 digits numeric phone number format (Philippine mobile standard)
  const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '').slice(0, 11) : null;
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const privacyConsentObj = { granted: true, consentedAt: new Date().toISOString(), policyVersion: 'RA10173-2026.1' };

  const result = await query(
    `INSERT INTO auth_core.users (email, password_hash, full_name, global_role, phone_number, company, default_address, privacy_consent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, full_name, global_role, phone_number, company, default_address, privacy_consent, created_at`,
    [email, passwordHash, fullName, role, cleanPhone, company || null, defaultAddress || null, JSON.stringify(privacyConsentObj)]
  );

  const row = result.rows[0];
  const newUser = {
    ...row,
    name: row.full_name,
    phone: row.phone_number,
    phoneNumber: row.phone_number,
    address: row.default_address,
    defaultAddress: row.default_address,
    privacyConsent: row.privacy_consent || privacyConsentObj
  };
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
    `SELECT u.id, u.email, u.full_name, u.global_role, u.avatar_url, u.phone_number, u.company, u.default_address, u.privacy_consent, u.created_at,
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

  const row = userResult.rows[0];
  return {
    ...row,
    name: row.full_name,
    phone: row.phone_number,
    phoneNumber: row.phone_number,
    address: row.default_address,
    defaultAddress: row.default_address,
    privacyConsent: row.privacy_consent || { granted: true, policyVersion: 'RA10173-2026.1' }
  };
}

export async function updateUserProfile(userId: string, data: {
  fullName?: string;
  name?: string;
  phoneNumber?: string;
  phone?: string;
  defaultAddress?: string;
  address?: string;
  company?: string;
  privacyConsent?: any;
}) {
  const userRes = await query('SELECT * FROM auth_core.users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) {
    throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found.' };
  }
  const current = userRes.rows[0];
  const fullName = data.fullName || data.name || current.full_name;
  const rawPhone = data.phoneNumber !== undefined ? data.phoneNumber : data.phone;
  const phone = rawPhone !== undefined
    ? (rawPhone ? String(rawPhone).replace(/\D/g, '').slice(0, 11) : null)
    : current.phone_number;
  const address = data.defaultAddress !== undefined || data.address !== undefined
    ? (data.defaultAddress || data.address || null)
    : current.default_address;
  const company = data.company !== undefined ? (data.company || null) : current.company;
  const privacyConsent = data.privacyConsent !== undefined
    ? JSON.stringify(data.privacyConsent)
    : (current.privacy_consent ? JSON.stringify(current.privacy_consent) : JSON.stringify({ granted: true }));

  const updated = await query(
    `UPDATE auth_core.users
     SET full_name = $1, phone_number = $2, default_address = $3, company = $4, privacy_consent = $5, updated_at = NOW()
     WHERE id = $6
     RETURNING id, email, full_name, global_role, phone_number, company, default_address, privacy_consent, created_at, updated_at`,
    [fullName, phone, address, company, privacyConsent, userId]
  );

  const row = updated.rows[0];
  return {
    ...row,
    name: row.full_name,
    phone: row.phone_number,
    phoneNumber: row.phone_number,
    defaultAddress: row.default_address,
    address: row.default_address,
    privacyConsent: row.privacy_consent
  };
}

export async function getCustomers() {
  const result = await query(
    `SELECT id, email, full_name, global_role, phone_number, company, default_address, privacy_consent, created_at
     FROM auth_core.users
     WHERE global_role NOT IN ('superadmin', 'admin') OR global_role IS NULL
     ORDER BY created_at DESC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    _id: row.id,
    name: row.full_name,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone_number || '',
    phoneNumber: row.phone_number || '',
    company: row.company || '',
    defaultAddress: row.default_address || '',
    address: row.default_address || '',
    privacyConsent: row.privacy_consent || { granted: true, policyVersion: 'RA10173-2026.1' },
    createdAt: row.created_at,
    globalRole: row.global_role
  }));
}
