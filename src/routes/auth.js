import { getRows, addRow } from '../sheets.js';
import { comparePassword, verifyAuth } from '../auth.js';
import { sendOTPEmail } from '../mailer.js';
import bcrypt from 'bcryptjs';

// In-memory cache for OTP codes with 10-minute expiry
const otpCache = new Map();

export default async function authRoutes(fastify, options) {
  // POST /api/auth/send-otp - Send 6-digit verification code via Corporate Mail
  fastify.post('/send-otp', async (request, reply) => {
    const { email } = request.body || {};

    if (!email || !email.trim()) {
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
      designation: user.designation
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation
      }
    };
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [verifyAuth] }, async (request, reply) => {
    return { user: request.user };
  });
}
