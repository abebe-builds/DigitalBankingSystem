/**
 * sidebar.js — Role-based navigation sidebar renderer.
 * Handles hamburger toggle for mobile, active link highlighting.
 */
import { logout } from '../auth.js';

/** Navigation items per role */
const NAV_ITEMS = {
  'Customer': [
    { icon: '🏦', label: 'My Accounts',    hash: 'accounts' },
    { icon: '📋', label: 'Applications',   hash: 'applications' },
    { icon: '💸', label: 'Transfer',       hash: 'transfer' },
    { icon: '📱', label: 'Verify Account', hash: 'otp' },
    { icon: '👤', label: 'Profile',        hash: 'profile' },
  ],
  'Account Opening Employee': [
    { icon: '📋', label: 'Applications', hash: 'applications' },
    { icon: '📄', label: 'Documents', hash: 'documents' },
  ],
  'KYC/Compliance Officer': [
    { icon: '📋', label: 'Applications', hash: 'applications' },
    { icon: '🔍', label: 'KYC Review', hash: 'kyc' },
  ],
  'Manager/Authorized Approver': [
    { icon: '✅', label: 'Approvals',        hash: 'approvals' },
    { icon: '🏦', label: 'Activate Accounts', hash: 'accounts' },
    { icon: '👥', label: 'Users',             hash: 'users' },
  ],
  'Cashier/Teller': [
    { icon: '💰', label: 'Teller Ops', hash: 'teller' },
    { icon: '📊', label: 'Transactions', hash: 'transactions' },
    { icon: '📈', label: 'Daily Summary', hash: 'summary' },
  ],
  'Customer Support': [
    { icon: '🏦', label: 'Accounts', hash: 'accounts' },
    { icon: '👥', label: 'Users', hash: 'users' },
  ],
  'Auditor': [
    { icon: '📊', label: 'Transactions', hash: 'transactions' },
    { icon: '🏦', label: 'Accounts', hash: 'accounts' },
    { icon: '⚖️', label: 'Audit', hash: 'audit' },
  ],
  'Operations/Finance': [
    { icon: '⚖️', label: 'Reconciliation', hash: 'reconciliation' },
    { icon: '📊', label: 'Transactions', hash: 'transactions' },
    { icon: '🏦', label: 'Accounts', hash: 'accounts' },
  ],
  'System Administrator': [
    { icon: '👥', label: 'Users', hash: 'users' },
    { icon: '⚙️', label: 'System', hash: 'system' },
  ],
};

/**
 * Returns current hash without the leading '#'.
 */
function currentHash() {
  return (window.location.hash || '').replace('#', '');
}

/**
 * Renders sidebar navigation for the given user.
 * @param {object} user - session user object
 */
export function renderSidebar(user) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const items = NAV_ITEMS[user.role_name] || [];

  // Build sidebar HTML
  const roleBadgeEl = document.getElementById('role-badge');
  if (roleBadgeEl) {
    roleBadgeEl.textContent = user.role_name;
  }

  const navEl = document.getElementById('sidebar-nav');
  if (navEl) {
    navEl.innerHTML = items
      .map(
        (item) => `
        <li class="sidebar__nav-item">
          <a
            href="#${item.hash}"
            class="sidebar__nav-link${currentHash() === item.hash ? ' sidebar__nav-link--active' : ''}"
            data-hash="${item.hash}"
          >
            <span class="sidebar__nav-icon" aria-hidden="true">${item.icon}</span>
            <span class="sidebar__nav-label">${item.label}</span>
          </a>
        </li>
      `,
      )
      .join('');
  }

  // Sidebar logout button
  const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', () => logout());
  }

  // Hamburger toggle (mobile)
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('sidebar-overlay');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('sidebar--open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      if (overlay) {
        overlay.style.display = isOpen ? 'block' : 'none';
        overlay.setAttribute('aria-hidden', String(!isOpen));
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('sidebar--open');
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    });
  }

  // Update active item on hash change
  window.addEventListener('hashchange', () => {
    const hash = currentHash();
    const links = document.querySelectorAll('.sidebar__nav-link');
    links.forEach((link) => {
      const active = link.getAttribute('data-hash') === hash;
      link.classList.toggle('sidebar__nav-link--active', active);
    });
    // Close mobile sidebar on navigation
    sidebar.classList.remove('sidebar--open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
  });
}

/**
 * Renders bottom navigation (mobile) for the given user.
 * Shows first 4 nav items for the role.
 * @param {object} user
 */
export function renderBottomNav(user) {
  const bottomNav = document.getElementById('bottom-nav');
  if (!bottomNav) return;

  const items = (NAV_ITEMS[user.role_name] || []).slice(0, 4);

  bottomNav.innerHTML = items
    .map(
      (item) => `
      <a
        href="#${item.hash}"
        class="bottom-nav__item${currentHash() === item.hash ? ' bottom-nav__item--active' : ''}"
        data-hash="${item.hash}"
        aria-label="${item.label}"
      >
        <span class="bottom-nav__icon" aria-hidden="true">${item.icon}</span>
        <span class="bottom-nav__label">${item.label}</span>
      </a>
    `,
    )
    .join('');

  // Update active on hash change
  window.addEventListener('hashchange', () => {
    const hash = currentHash();
    bottomNav.querySelectorAll('.bottom-nav__item').forEach((link) => {
      link.classList.toggle('bottom-nav__item--active', link.getAttribute('data-hash') === hash);
    });
  });
}
