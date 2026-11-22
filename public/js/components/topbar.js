/**
 * topbar.js — Topbar renderer with user info and logout button.
 */
import { logout } from '../auth.js';

/** Human-readable labels for each hash segment */
const PAGE_TITLES = {
  accounts: 'Accounts',
  applications: 'Applications',
  transfer: 'Transfer',
  profile: 'Profile',
  documents: 'Documents',
  kyc: 'KYC Review',
  approvals: 'Approvals',
  users: 'Users',
  teller: 'Teller Operations',
  transactions: 'Transactions',
  summary: 'Daily Summary',
  audit: 'Audit Log',
  reconciliation: 'Reconciliation',
  system: 'System Info',
};

function currentHash() {
  return (window.location.hash || '').replace('#', '');
}

function getPageTitle(hash) {
  return PAGE_TITLES[hash] || 'Dashboard';
}

/**
 * Renders the top bar with user details and logout.
 * @param {object} user - session user
 */
export function renderTopbar(user) {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  // User initials (first letter of email)
  const initials = (user.email || '?')[0].toUpperCase();

  // Set initial page title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    titleEl.textContent = getPageTitle(currentHash());
  }

  // User name + role
  const nameEl = document.getElementById('topbar-user-name');
  if (nameEl) {
    nameEl.textContent = user.email;
  }

  const roleEl = document.getElementById('topbar-role');
  if (roleEl) {
    roleEl.textContent = user.role_name;
  }

  // Avatar initials
  const avatarEl = document.getElementById('topbar-avatar');
  if (avatarEl) {
    avatarEl.textContent = initials;
    avatarEl.style.background = 'var(--color-primary, #1a3c5e)';
    avatarEl.style.color = '#fff';
    avatarEl.style.borderRadius = '50%';
    avatarEl.style.width = '36px';
    avatarEl.style.height = '36px';
    avatarEl.style.display = 'flex';
    avatarEl.style.alignItems = 'center';
    avatarEl.style.justifyContent = 'center';
    avatarEl.style.fontWeight = '700';
    avatarEl.style.fontSize = '0.95rem';
    avatarEl.setAttribute('title', user.email);
  }

  // Logout button
  const logoutBtn = document.getElementById('topbar-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }

  // Update title on hash change
  window.addEventListener('hashchange', () => {
    if (titleEl) {
      titleEl.textContent = getPageTitle(currentHash());
    }
  });
}

export default renderTopbar;
