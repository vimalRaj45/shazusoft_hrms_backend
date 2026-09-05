import { getRows, addRow, updateRow } from '../db.js';
import { comparePassword, verifyAuth } from '../auth.js';
import { sendOTPEmail } from '../mailer.js';
import bcrypt from 'bcryptjs';

// In-memory cache for OTP codes with 10-minute expiry
const otpCache = new Map();

export default async function authRoutes(fastify, options) {
  // POST /api/auth/send-otp - Send 6-digit verification code via Corporate Mail
  fastify.post('/send-otp', async (request, reply) => {
    const { email } = request.body || {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !email.trim() || !emailRegex.test(email.trim())) {
      return reply.status(400).send({ error: 'Please enter a valid work email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const employees = await getRows('Employees');
    let user = employees.find(e => e.email?.toLowerCase() === cleanEmail && e.status !== 'inactive');

    // For production: Ensure only registered employees can log in.
    // If user is not yet in Employees sheet, allow auto-provisioning ONLY for the root admin.
    if (!user) {
      if (cleanEmail === 'vimalraj5207@gmail.com') {
        user = {
          id: 'EMP-ADMIN-01',
          name: 'Vimal Raj',
          email: 'vimalraj5207@gmail.com',
          password_hash: 'OTP_AUTH_ENABLED',
          role: 'admin',
          department: 'Executive Management',
          designation: 'Managing Director & Administrator',
          status: 'active',
          created_at: new Date().toISOString()
        };
        await addRow('Employees', user);
      } else {
        return reply.status(404).send({
          error: `No registered account found with email "${cleanEmail}". Please contact system administrator (vimalraj5207@gmail.com) to register your account.`
        });
      }
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpCache.set(cleanEmail, {
      otp,
      expiresAt,
      attempts: 0,
      userName: user.name
    });

    try {
      await sendOTPEmail({
        toEmail: cleanEmail,
        otp,
        employeeName: user.name
      });

      return {
        success: true,
        message: `A 6-digit verification code has been sent to ${cleanEmail}.`
      };
    } catch (err) {
      console.error('[Mail Delivery Error]', err.response?.data || err.message);
      return reply.status(500).send({
        error: 'Unable to dispatch verification email at this moment. Please check the email address or try again.',
        details: err.message
      });
    }
  });

  // POST /api/auth/verify-otp - Verify OTP code & authenticate
  fastify.post('/verify-otp', async (request, reply) => {
    const { email, otp } = request.body || {};

    if (!email || !otp) {
      return reply.status(400).send({ error: 'Email and 6-digit OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const cached = otpCache.get(cleanEmail);
    if (!cached) {
      return reply.status(400).send({ error: 'No active OTP verification session found. Please request a new code.' });
    }

    if (Date.now() > cached.expiresAt) {
      otpCache.delete(cleanEmail);
      return reply.status(400).send({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (cached.attempts >= 5) {
      otpCache.delete(cleanEmail);
      return reply.status(429).send({ error: 'Too many invalid attempts. Please request a new verification code.' });
    }

    if (cached.otp !== cleanOtp) {
      cached.attempts += 1;
      return reply.status(401).send({ error: `Invalid verification code. ${5 - cached.attempts} attempts remaining.` });
    }

    // OTP is valid - remove from cache
    otpCache.delete(cleanEmail);

    const employees = await getRows('Employees');
    const user = employees.find(e => e.email?.toLowerCase() === cleanEmail && e.status !== 'inactive');

    if (!user) {
      return reply.status(404).send({ error: 'User account not found.' });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      work_mode: user.work_mode || 'office'
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        work_mode: user.work_mode || 'office'
      }
    };
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [verifyAuth] }, async (request, reply) => {
    const employees = await getRows('Employees');
    const freshUser = employees.find(e => e.id === request.user.id);
    if (freshUser) {
      const { password_hash, ...clean } = freshUser;
      return { user: { ...clean, work_mode: clean.work_mode || 'office' } };
    }
    return { user: { ...request.user, work_mode: request.user.work_mode || 'office' } };
  });

  // GET /api/auth/profile - Retrieve full employee profile with company records
  fastify.get('/profile', { preHandler: [verifyAuth] }, async (request, reply) => {
    const employees = await getRows('Employees');
    const user = employees.find(e => e.id === request.user.id);
    if (!user) {
      return reply.status(404).send({ error: 'Employee record not found.' });
    }

    let personalInfo = {};
    let statutoryInfo = {};
    let emergencyContacts = {};
    let documents = [];

    try { personalInfo = user.personal_info ? (typeof user.personal_info === 'string' ? JSON.parse(user.personal_info) : user.personal_info) : {}; } catch (e) {}
    try { statutoryInfo = user.statutory_info ? (typeof user.statutory_info === 'string' ? JSON.parse(user.statutory_info) : user.statutory_info) : {}; } catch (e) {}
    try { emergencyContacts = user.emergency_contacts ? (typeof user.emergency_contacts === 'string' ? JSON.parse(user.emergency_contacts) : user.emergency_contacts) : {}; } catch (e) {}
    try { documents = user.documents_json ? (typeof user.documents_json === 'string' ? JSON.parse(user.documents_json) : user.documents_json) : []; } catch (e) {}

    const { password_hash, ...cleanUser } = user;

    return {
      success: true,
      profile: {
        ...cleanUser,
        phone: user.phone || '',
        avatar_url: user.avatar_url || '',
        personal_info: personalInfo,
        statutory_info: statutoryInfo,
        emergency_contacts: emergencyContacts,
        documents: Array.isArray(documents) ? documents : [],
        profile_completeness: parseInt(user.profile_completeness, 10) || 0
      }
    };
  });

  // PUT /api/auth/profile - Update employee profile and uploaded company documents
  fastify.put('/profile', { preHandler: [verifyAuth] }, async (request, reply) => {
    const {
      phone,
      avatar_url,
      personal_info,
      statutory_info,
      emergency_contacts,
      documents
    } = request.body || {};

    const employees = await getRows('Employees');
    const user = employees.find(e => e.id === request.user.id);
    if (!user) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    // Calculate completeness score based on filled fields
    let filledCount = 0;
    let totalFields = 12;

    if (avatar_url || user.avatar_url) filledCount += 1;
    if (phone || user.phone) filledCount += 1;
    if (personal_info?.dob) filledCount += 1;
    if (personal_info?.gender) filledCount += 1;
    if (personal_info?.blood_group) filledCount += 1;
    if (personal_info?.current_address) filledCount += 1;
    if (emergency_contacts?.contact_name && emergency_contacts?.contact_phone) filledCount += 2;
    if (statutory_info?.pan_number) filledCount += 1;
    if (statutory_info?.aadhaar_number) filledCount += 1;
    if (statutory_info?.bank_account_number && statutory_info?.ifsc_code) filledCount += 1;
    if (Array.isArray(documents) && documents.length > 0) filledCount += 1;

    const completenessScore = Math.min(100, Math.round((filledCount / totalFields) * 100));

    const updatePayload = {
      profile_completeness: completenessScore
    };

    if (phone !== undefined) updatePayload.phone = phone;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;
    if (personal_info !== undefined) updatePayload.personal_info = JSON.stringify(personal_info);
    if (statutory_info !== undefined) updatePayload.statutory_info = JSON.stringify(statutory_info);
    if (emergency_contacts !== undefined) updatePayload.emergency_contacts = JSON.stringify(emergency_contacts);
    if (documents !== undefined) updatePayload.documents_json = JSON.stringify(documents);

    const updated = await updateRow('Employees', 'id', user.id, updatePayload);

    return {
      success: true,
      message: 'Profile records and documents updated successfully.',
      profile: {
        ...updated,
        personal_info: personal_info || {},
        statutory_info: statutory_info || {},
        emergency_contacts: emergency_contacts || {},
        documents: documents || [],
        profile_completeness: completenessScore
      }
    };
  });
}
