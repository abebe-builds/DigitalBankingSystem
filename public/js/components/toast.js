/**
 * toast.js — toast notification queue
 * Auto-dismisses after 4s, max 5 toasts at once.
 */

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 4000;

function getContainer() {
  return document.getElementById('toast-container');
}

/**
 * Creates and shows a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 */
function show(message, type) {
  const container = getContainer();
  if (!container) return;

  // Remove oldest if at max
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= MAX_TOASTS) {
    existing[0].remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const icon = icons[type] || 'ℹ️';

  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icon}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button type="button" class="toast__close" aria-label="Dismiss notification">✕</button>
  `;

  // Close button click
  toast.querySelector('.toast__close').addEventListener('click', () => {
    removeToast(toast);
  });

  container.appendChild(toast);

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  // Auto-dismiss
  const timer = setTimeout(() => removeToast(toast), AUTO_DISMISS_MS);
  toast._dismissTimer = timer;
}

function removeToast(toast) {
  if (toast._dismissTimer) clearTimeout(toast._dismissTimer);
  toast.classList.remove('toast--visible');
  toast.classList.add('toast--leaving');
  // Remove from DOM after animation
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export const toast = {
  success: (msg) => show(msg, 'success'),
  error: (msg) => show(msg, 'error'),
  warning: (msg) => show(msg, 'warning'),
  info: (msg) => show(msg, 'info'),
};

export default toast;
