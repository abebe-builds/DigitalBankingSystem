/**
 * support.js — Customer Support views.
 * Views: accounts (read-only), users
 */
import api from '../api.js';
import { cardSkeletons, tableRowSkeletons } from '../components/skeleton.js';
import { renderAccountCards } from '../components/accountCard.js';

export async function render(container, view, user) {
  switch (view) {
    case 'users':
      await renderUsers(container, user);
      break;
    case 'accounts':
    default:
      await renderAccounts(container, user);
      break;
  }
}

// ─── ACCOUNTS (read-only) ─────────────────────────────────────────────────────
async function renderAccounts(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Accounts</h2>
    <div class="stat-grid" id="stat-grid">
      ${cardSkeletons(4)}
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="form-group" style="margin:0;">
        <input type="text" id="account-search" class="form-control" placeholder="Search by account number…" />
      </div>
    </div>
    <div id="accounts-list" class="card-grid">
      ${cardSkeletons(4)}
    </div>
  `;

  let allAccounts = [];

  try {
    const [accRes, usersRes] = await Promise.allSettled([
      api.get('/accounts'),
      api.get('/users'),
    ]);

    allAccounts = accRes.status === 'fulfilled' ? (accRes.value.accounts || accRes.value.data || []) : [];
    const users = usersRes.status === 'fulfilled' ? (usersRes.value.users || usersRes.value.data || []) : [];

    const active = allAccounts.filter((a) => a.status === 'ACTIVE').length;
    const suspended = allAccounts.filter((a) => a.status === 'SUSPENDED').length;

    document.getElementById('stat-grid').innerHTML = `
      ${statCard('Total Accounts', allAccounts.length, 'accent--primary')}
      ${statCard('Active Accounts', active, 'accent--success')}
      ${statCard('Suspended Accounts', suspended, 'accent--warning')}
      ${statCard('Total Users', users.length, 'accent--info')}
    `;

    const listEl = document.getElementById('accounts-list');
    renderAccountCards(allAccounts, listEl, user.role_name);

    // Client-side search filter
    const searchInput = document.getElementById('account-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = q
          ? allAccounts.filter(
              (a) =>
                (a.account_number || '').toLowerCase().includes(q) ||
                String(a.id).includes(q),
            )
          : allAccounts;
        renderAccountCards(filtered, listEl, user.role_name);
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

// ─── USERS ────────────────────────────────────────────────────────────────────
async function renderUsers(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Users</h2>
    <div class="card">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowSkeletons(5, 4)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const res = await api.get('/users');
    const users = res.users || res.data || [];

    const tbody = container.querySelector('tbody');
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No users found</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
        <tr>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="badge badge--pending">${escapeHtml(u.role_name || '-')}</span></td>
          <td><span class="badge badge--${u.status === 'active' ? 'active' : 'suspended'}">${escapeHtml(u.status || '-')}</span></td>
          <td>${u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
        </tr>
      `,
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function statCard(label, value, accent) {
  return `
    <div class="card stat-card ${accent}">
      <div class="stat-card__value">${escapeHtml(String(value))}</div>
      <div class="stat-card__label">${escapeHtml(label)}</div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
