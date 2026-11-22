/**
 * auth.js — Session management for login, dashboard bootstrap,
 * logout, and change-password flow.
 */
import api from './api.js';
import toast from './components/toast.js';

const SESSION_KEY = 'dbs_user';

// ─── 1. LOGIN FORM ────────────────────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
  setupLoginForm(loginForm);
}

function setupLoginForm(form) {
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('form-error');
  const togglePw = document.getElementById('toggle-password');
  const pwInput = document.getElementById('password');

  // Toggle password visibility
  if (togglePw && pwInput) {
    togglePw.addEventListener('click', () => {
      const visible = pwInput.type === 'text';
      pwInput.type = visible ? 'password' : 'text';
      togglePw.setAttribute('aria-pressed', String(!visible));
      togglePw.textContent = visible ? '👁' : '🙈';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    // Clear previous error
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }

    if (!email || !password) {
      showFormError(errorEl, 'Please enter your email and password.');
      return;
    }

    setLoading(btn, true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const user = res.user || res.data;

      // Store user in session
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));

      // Redirect to dashboard
      window.location.replace('/dashboard.html');
    } catch (err) {
      const message =
        err.body?.error || err.message || 'Login failed. Please check your credentials.';
      showFormError(errorEl, message);
    } finally {
      setLoading(btn, false);
    }
  });
}

function showFormError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  const span = btn.querySelector('span');
  if (span) {
    span.textContent = loading ? 'Signing in…' : 'Sign In';
  }
}

// ─── 2. DASHBOARD BOOTSTRAP ──────────────────────────────────────────────────
const viewContainer = document.getElementById('view-container');
if (viewContainer) {
  document.addEventListener('DOMContentLoaded', bootstrapDashboard);
}

async function bootstrapDashboard() {
  try {
    const res = await api.get('/auth/me');
    const user = res.user || res.data;

    if (user.must_change_password === 1 || user.must_change_password === true) {
      window.location.replace('/change-password.html');
      return;
    }

    // Store user in sessionStorage
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));

    // Dispatch custom event so router.js can initialize
    document.dispatchEvent(
      new CustomEvent('user-ready', { detail: user, bubbles: true }),
    );
  } catch {
    // 401 is handled by api.js → redirects to /login.html automatically
  }
}

// ─── 3. LOGOUT ───────────────────────────────────────────────────────────────
export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // Proceed even if request fails
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('/login.html');
  }
}

// ─── 4. CHANGE PASSWORD FORM ─────────────────────────────────────────────────
const changePwForm = document.getElementById('change-password-form');
if (changePwForm) {
  setupChangePasswordForm(changePwForm);
}

function setupChangePasswordForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password')?.value;
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;

    const errorEl = document.getElementById('cp-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }

    if (!currentPassword || !newPassword) {
      if (errorEl) {
        errorEl.textContent = 'All fields are required.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (errorEl) {
        errorEl.textContent = 'New passwords do not match.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully. Please sign in again.');
      setTimeout(() => {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.replace('/login.html');
      }, 1500);
    } catch (err) {
      const message = err.body?.error || err.message || 'Failed to change password.';
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
      } else {
        toast.error(message);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
