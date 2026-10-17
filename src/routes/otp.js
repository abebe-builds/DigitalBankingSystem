import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { createOTP, verifyOTP } from '../services/otpService.js';

export const otpRouter = Router();

const VALID_PURPOSES = ['PHONE_VERIFICATION', 'EMAIL_VERIFICATION', 'APPLICATION_APPROVAL'];

/**
 * POST /api/otp/send
 * Body: { purpose, application_id? }
 * Sends (simulates) an OTP for the authenticated user.
 * NOTE: In production, SMS/email delivery would be triggered here.
 */
otpRouter.post('/send', requireAuth, async (req, res, next) => {
  try {
    const { purpose, application_id = null } = req.body;
    if (!VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({ status: 'error', error: 'Invalid purpose' });
    }
    await createOTP(req.user.id, purpose, application_id);
    return res.status(200).json({
      status: 'ok',
      message: 'OTP sent (simulated — check server logs in development)',
      purpose,
    });
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
