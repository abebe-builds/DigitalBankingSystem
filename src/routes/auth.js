import { Router } from 'express';
import { loginLimiter } from '../middleware/loginLimiter.js';
import { requireAuth } from '../middleware/authenticate.js';
import {
  findUserByEmail,
  verifyPassword,
  dummyVerify,
  isLockedOut,
  recordFailedLogin,
  recordSuccessfulLogin,
  validatePasswordPolicy,
  changePassword,
  registerCustomer,
} from '../services/authService.js';
import { createApplication, submitApplication } from '../services/applicationService.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: 'error', error: 'Email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);
    const GENERIC_ERROR = 'Invalid email or password';
    if (!user) {
      // Equalize timing with the known-user/wrong-password path to prevent
      // timing-based email enumeration. dummyVerify runs bcrypt.compare against
      // a pre-computed hash and always returns false.
      await dummyVerify(password);
      return res.status(401).json({ status: 'error', error: GENERIC_ERROR });
    }
    if (isLockedOut(user)) {
      return res.status(403).json({ status: 'error', error: 'Account is temporarily locked due to too many failed login attempts' });
    }
    if (user.status === 'suspended' || user.status === 'closed') {
      return res.status(403).json({ status: 'error', error: 'Account is not active' });
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await recordFailedLogin(user.id);
      return res.status(401).json({ status: 'error', error: GENERIC_ERROR });
    }
    // Successful login: regenerate session to prevent fixation
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    const safeUser = {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      status: user.status,
      must_change_password: user.must_change_password,
      last_login_at: user.last_login_at,
    };
    req.session.user = safeUser;
    await recordSuccessfulLogin(user.id);
    return res.status(200).json({ status: 'ok', user: safeUser });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    if (err) {
      return res.status(500).json({ status: 'error', error: 'Logout failed' });
    }
    return res.status(200).json({ status: 'ok', message: 'Logged out' });
  });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({ status: 'ok', user: req.user });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', error: 'currentPassword and newPassword are required' });
    }
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return res.status(400).json({ status: 'error', error: 'Password does not meet policy requirements', details: policy.errors });
    }
    await changePassword(req.user.id, currentPassword, newPassword);
    return res.status(200).json({ status: 'ok', message: 'Password changed successfully' });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ status: 'error', error: err.message, ...(err.errors ? { details: err.errors } : {}) });
    }
    next(err);
  }
});

// POST /api/auth/register
// Public endpoint — creates a new Customer account + draft application in one step.
// Rate-limited via the API-wide limiter (no separate limiter needed here).
authRouter.post('/register', async (req, res, next) => {
  try {
    const {
      email, password,
      first_name, last_name, date_of_birth, national_id, nationality,
      phone, address_line1, address_line2, city,
      account_type, initial_deposit_amount, currency,
      terms_accepted, privacy_accepted,
    } = req.body;

    // Basic presence checks
    if (!email || !password) {
      return res.status(400).json({ status: 'error', error: 'Email and password are required' });
    }
    if (!first_name || !last_name || !date_of_birth || !national_id || !phone || !address_line1 || !city) {
      return res.status(400).json({ status: 'error', error: 'All personal information fields are required' });
    }
    if (!terms_accepted || !privacy_accepted) {
      return res.status(400).json({ status: 'error', error: 'You must accept the Terms & Conditions and Privacy Policy' });
    }

    // 1. Create the Customer user account
    const user = await registerCustomer(email, password);

    // 2. Create and immediately submit a draft application for this user
    const appData = {
      account_type: account_type || 'SAVINGS',
      first_name, last_name, date_of_birth, national_id,
      nationality: nationality || 'Ethiopian',
      phone, email: email.trim().toLowerCase(),
      address_line1, address_line2: address_line2 || null, city,
      initial_deposit_amount: parseFloat(initial_deposit_amount) || 0,
      currency: currency || 'ETB',
      terms_accepted: 1,
      privacy_accepted: 1,
    };

    const application = await createApplication(user.id, appData);
    const submitted = await submitApplication(application.id, user.id);

    // 3. Log the new user in automatically (regenerate session)
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.user = user;

    return res.status(201).json({
      status: 'ok',
      message: 'Account created and application submitted successfully.',
      user,
      application: {
        id: submitted.id,
        reference_number: submitted.reference_number,
        status: submitted.status,
        account_type: submitted.account_type,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        status: 'error',
        error: err.message,
        ...(err.errors ? { details: err.errors } : {}),
      });
    }
    next(err);
  }
});
