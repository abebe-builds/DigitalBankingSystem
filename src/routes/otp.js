import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { createOTP, verifyOTP } from '../services/otpService.js';
import { pool } from '../db/pool.js';

export const otpRouter = Router();

const VALID_PURPOSES = ['PHONE_VERIFICATION', 'EMAIL_VERIFICATION', 'APPLICATION_APPROVAL'];

/** Mask phone: +251911000001 → +251911***001 */
function maskPhone(phone) {
  if (!phone) return '+251 *** *** ***';
  const s = String(phone).replace(/\s/g, '');
  if (s.length <= 6) return s;
  const prefix = s.slice(0, Math.max(4, s.length - 6));
  const suffix = s.slice(-3);
  return prefix + '***' + suffix;
}

/** Mask email: abebe@example.com → ab***@example.com */
function maskEmail(email) {
  if (!email) return '***@***.com';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return visible + '***@' + domain;
}

otpRouter.post('/send', requireAuth, async (req, res, next) => {
  try {
    const { purpose, application_id = null } = req.body;
    if (!VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({ status: 'error', error: 'Invalid purpose' });
    }

    const plaintext = await createOTP(req.user.id, purpose, application_id);

    // Fetch customer's latest application to get their phone & email
    const [appRows] = await pool.query(
      `SELECT phone, email FROM account_applications
       WHERE customer_user_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.id],
    );
    const app = appRows[0] || {};

    const isProd = process.env.NODE_ENV === 'production';

    const response = {
      status: 'ok',
      purpose,
      // Masked contact info — safe to send in all environments
      masked_phone: maskPhone(app.phone),
      masked_email: maskEmail(app.email || req.user.email),
      // In development return the OTP so the UI shows the simulated delivery.
      // In production this is omitted — real SMS/email gateway delivers it.
      ...(!isProd && {
        dev_otp: plaintext,
        dev_note: 'SIMULATION — In production delivered via SMS/email gateway',
      }),
      message: isProd
        ? `OTP sent to your registered ${purpose === 'PHONE_VERIFICATION' ? 'phone number' : 'email address'}`
        : 'OTP generated (simulation mode)',
    };

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/otp/verify
 * Body: { purpose, token, application_id? }
 * Verifies a submitted OTP token.
 */
otpRouter.post('/verify', requireAuth, async (req, res, next) => {
  try {
    const { purpose, token, application_id = null } = req.body;
    if (!purpose || !token) {
      return res.status(400).json({ status: 'error', error: 'purpose and token are required' });
    }
    const result = await verifyOTP(req.user.id, purpose, token, application_id);
    if (result.valid) {
      return res.status(200).json({ status: 'ok', valid: true });
    }
    return res.status(400).json({ status: 'error', valid: false, error: result.reason });
  } catch (err) {
    next(err);
  }
});
