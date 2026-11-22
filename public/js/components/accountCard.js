/**
 * accountCard.js — Renders account cards with status badges and role-aware actions.
 */
import api from '../api.js';
import toast from './toast.js';

/** Badge class mapping by status */
const STATUS_BADGE = {
  ACTIVE: 'badge--active',
  PENDING: 'badge--pending',
  SUSPENDED: 'badge--suspended',
  CLOSED: 'badge--closed',
};

/**
 * Format a number as ETB currency.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return `ETB ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders account cards into a container element.
 * @param {Array} accounts - list of account objects
 * @param {HTMLElement} container - DOM element to render into
 * @param {string} role - current user's role_name
 * @param {Function} [onRefresh] - callback to re-fetch and re-render
 */
export function renderAccountCards(accounts, container, role, onRefresh) {
  if (!container) return;
  container.innerHTML = '';

  if (!accounts || accounts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon" aria-hidden="true">🏦</span>
        <p class="empty-state__message">No accounts found</p>
      </div>
    `;
    return;
  }

  accounts.forEach((account) => {
    const card = document.createElement('div');
    card.className = 'card account-card';

    const badgeClass = STATUS_BADGE[account.status] || 'badge--pending';

    card.innerHTML = `
      <div class="account-card__header">
        <span class="account-card__type">${escapeHtml(account.account_type || 'Account')}</span>
        <span class="badge ${badgeClass}">${escapeHtml(account.status || '')}</span>
      </div>
      <div class="account-card__number">
        <span class="account-card__number-label">Account No.</span>
        <code class="account-card__number-value">${escapeHtml(account.account_number || account.id || '')}</code>
      </div>
      <div class="account-card__balance">
        ${formatCurrency(account.balance || 0)}
      </div>
      <div class="account-card__footer" id="card-actions-${account.id}">
        ${buildActionButtons(account, role)}
      </div>
    `;

    // Attach action button handlers
    attachActionHandlers(card, account, role, onRefresh);

    container.appendChild(card);
  });
}

/**
 * Build action button HTML for manager role.
 */
function buildActionButtons(account, role) {
  if (role !== 'Manager/Authorized Approver') return '';

  const buttons = [];
  if (account.status === 'PENDING') {
    buttons.push(`<button type="button" class="btn btn--success btn--sm" data-action="activate" data-id="${account.id}">Activate</button>`);
  }
  if (account.status === 'ACTIVE') {
    buttons.push(`<button type="button" class="btn btn--warning btn--sm" data-action="suspend" data-id="${account.id}">Suspend</button>`);
    buttons.push(`<button type="button" class="btn btn--danger btn--sm" data-action="close" data-id="${account.id}">Close</button>`);
  }
  if (account.status === 'SUSPENDED') {
    buttons.push(`<button type="button" class="btn btn--success btn--sm" data-action="activate" data-id="${account.id}">Activate</button>`);
    buttons.push(`<button type="button" class="btn btn--danger btn--sm" data-action="close" data-id="${account.id}">Close</button>`);
  }
  return buttons.join(' ');
}

/**
 * Attach click handlers to action buttons.
 */
function attachActionHandlers(card, account, role, onRefresh) {
  if (role !== 'Manager/Authorized Approver') return;

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!action || !id) return;

    btn.disabled = true;
    btn.textContent = '...';

    try {
      await api.post(`/accounts/${id}/${action}`);
      toast.success(`Account ${action}d successfully`);
      if (typeof onRefresh === 'function') onRefresh();
    } catch (err) {
      toast.error(err.message || `Failed to ${action} account`);
      btn.disabled = false;
      btn.textContent = action.charAt(0).toUpperCase() + action.slice(1);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export default renderAccountCards;
