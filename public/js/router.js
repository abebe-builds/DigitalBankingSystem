/**
 * router.js — Hash-based SPA router.
 * Listens for 'user-ready' event, renders sidebar/topbar,
 * and dynamically imports the role-specific view module.
 */
import { renderSidebar, renderBottomNav } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';

/** Maps role_name → { default hash, view module path } */
const ROLE_VIEW_MAP = {
  'Customer': {
    default: 'accounts',
    module: './views/customer.js',
  },
  'Account Opening Employee': {
    default: 'applications',
    module: './views/account-opening.js',
  },
  'KYC/Compliance Officer': {
    default: 'applications',
    module: './views/kyc-officer.js',
  },
  'Manager/Authorized Approver': {
    default: 'approvals',
    module: './views/manager.js',
  },
  'Cashier/Teller': {
    default: 'teller',
    module: './views/cashier.js',
  },
  'Customer Support': {
    default: 'accounts',
    module: './views/support.js',
  },
  'Auditor': {
    default: 'transactions',
    module: './views/auditor.js',
  },
  'Operations/Finance': {
    default: 'reconciliation',
    module: './views/operations.js',
  },
  'System Administrator': {
    default: 'users',
    module: './views/sysadmin.js',
  },
};

let currentUser = null;
let currentModule = null;

/**
 * Returns current hash without leading '#'.
 */
function currentHash() {
  return (window.location.hash || '').replace('#', '');
}

/**
 * Navigate to current hash, loading the appropriate view.
 */
async function navigate() {
  if (!currentUser) return;

  const roleConfig = ROLE_VIEW_MAP[currentUser.role_name];
  if (!roleConfig) {
    const container = document.getElementById('view-container');
    if (container) {
      container.innerHTML = `
        <div class="alert alert-error">
          Unknown role: ${escapeHtml(currentUser.role_name)}. Contact your administrator.
        </div>
      `;
    }
    return;
  }

  let hash = currentHash();
  if (!hash) {
    hash = roleConfig.default;
    window.location.hash = hash;
    return; // hashchange will trigger navigate() again
  }

  const container = document.getElementById('view-container');
  if (!container) return;

  try {
    // Dynamic import of view module (cached after first load)
    if (!currentModule) {
      currentModule = await import(roleConfig.module);
    }

    if (typeof currentModule.render === 'function') {
      await currentModule.render(container, hash, currentUser);
    }
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-error">
        Failed to load view: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

/**
 * Initialize router when user session is ready.
 */
document.addEventListener('user-ready', (e) => {
  currentUser = e.detail;

  // Render chrome
  renderSidebar(currentUser);
  renderTopbar(currentUser);
  renderBottomNav(currentUser);

  // Initial navigation
  navigate();
});

/**
 * Handle hash changes for subsequent navigation.
 * Re-import not needed (module is cached), but render is always called.
 */
window.addEventListener('hashchange', async () => {
  if (!currentUser) return;

  const roleConfig = ROLE_VIEW_MAP[currentUser.role_name];
  if (!roleConfig) return;

  const hash = currentHash();
  const container = document.getElementById('view-container');
  if (!container) return;

  // Ensure module is loaded
  if (!currentModule) {
    try {
      currentModule = await import(roleConfig.module);
    } catch {
      return;
    }
  }

  if (typeof currentModule.render === 'function') {
    try {
      await currentModule.render(container, hash, currentUser);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str || '');
  return div.innerHTML;
}
