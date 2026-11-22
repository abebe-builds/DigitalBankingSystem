/**
 * sysadmin.js — System Administrator views.
 * Views: users (default), system
 */
import api from '../api.js';
import { tableRowSkeletons, cardSkeletons } from '../components/skeleton.js';

export async function render(container, view, user) {
  switch (view) {
    case 'system':
      renderSystem(container, user);
      break;
    case 'users':
    default:
      await renderUsers(container, user);
      break;
  }
}

// ─── USERS ────────────────────────────────────────────────────────────────────
async function renderUsers(container, user) {
  let page = 1;
  const limit = 25;

  async function loadUsers() {
    container.innerHTML = `
      <h2 class="view-title">Users</h2>
      <div class="stat-grid" id="stat-grid">
        ${cardSkeletons(4)}
      </div>
      <div class="card">
        <div class="table-container">
          <table class="table" aria-label="Users">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowSkeletons(6, 6)}
            </tbody>
          </table>
        </div>
        <div id="users-pagination" class="pagination" style="margin-top:16px;"></div>
      </div>
    `;

    try {
      const res = await api.get('/users', { page, limit });
      const users = res.users || res.data || [];
      const total = res.total || users.length;

      // Stat cards
      const activeCount = users.filter((u) => u.status === 'active').length;
      const inactiveCount = users.filter((u) => u.status !== 'active').length;

      document.getElementById('stat-grid').innerHTML = `
        ${statCard('Total Users', total, 'accent--primary')}
        ${statCard('Active Users', activeCount, 'accent--success')}
        ${statCard('Locked/Inactive', inactiveCount, 'accent--warning')}
        ${statCard('Total Roles', 9, 'accent--info')}
      `;

      const tbody = container.querySelector('tbody');
      if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>`;
        return;
      }

      tbody.innerHTML = users
        .map(
          (u) => `
          <tr>
            <td>${escapeHtml(String(u.id))}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${roleBadge(u.role_name)}</td>
            <td><span class="badge badge--${u.status === 'active' ? 'active' : 'suspended'}">${escapeHtml(u.status || '-')}</span></td>
            <td>${u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
            <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
          </tr>
        `,
        )
        .join('');

      // Pagination
      if (total > limit) {
        const pages = Math.ceil(total / limit);
        const pagEl = document.getElementById('users-pagination');
        if (pagEl) {
          pagEl.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
            .map(
              (p) =>
                `<button type="button" class="btn btn--sm ${p === page ? 'btn--primary' : 'btn--secondary'}" data-page="${p}">${p}</button>`,
            )
            .join(' ');

          pagEl.querySelectorAll('[data-page]').forEach((btn) => {
            btn.addEventListener('click', () => {
              page = parseInt(btn.getAttribute('data-page'), 10);
              loadUsers();
            });
          });
        }
      }
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  await loadUsers();
}

// ─── SYSTEM INFO ──────────────────────────────────────────────────────────────
function renderSystem(container, user) {
  container.innerHTML = `
    <h2 class="view-title">System Information</h2>
    <div class="stat-grid" id="sys-stats">
      ${cardSkeletons(4)}
    </div>
    <div class="card" style="margin-top:16px;">
      <h3>Service Details</h3>
      <dl class="details-list">
        <dt>Service</dt><dd>DigitalBank ETB Core Banking</dd>
        <dt>Environment</dt><dd>Development</dd>
        <dt>Current User</dt><dd>${escapeHtml(user.email || '-')}</dd>
        <dt>Role</dt><dd>${escapeHtml(user.role_name || '-')}</dd>
        <dt>Session</dt><dd>Managed via httpOnly cookie (connect.sid)</dd>
        <dt>API Base</dt><dd>/api</dd>
        <dt>Auth</dt><dd>Session-based (express-session + MariaDB store)</dd>
        <dt>Version</dt><dd>Phase 5</dd>
      </dl>
    </div>
  `;

  // Load user stats
  api.get('/users')
    .then((res) => {
      const users = res.users || res.data || [];
      const active = users.filter((u) => u.status === 'active').length;
      const inactive = users.filter((u) => u.status !== 'active').length;

      document.getElementById('sys-stats').innerHTML = `
        ${statCard('Total Users', users.length, 'accent--primary')}
        ${statCard('Active Users', active, 'accent--success')}
        ${statCard('Locked/Inactive', inactive, 'accent--warning')}
        ${statCard('Total Roles', 9, 'accent--info')}
      `;
    })
    .catch(() => {
      document.getElementById('sys-stats').innerHTML = cardSkeletons(4);
    });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
/** Returns a colored badge for a role name */
function roleBadge(roleName) {
  const colors = {
    'Customer': 'badge--active',
    'Account Opening Employee': 'badge--submitted',
    'KYC/Compliance Officer': 'badge--under-review',
    'Manager/Authorized Approver': 'badge--approved',
    'Cashier/Teller': 'badge--pending',
    'Customer Support': 'badge--correction-required',
    'Auditor': 'badge--account-created',
    'Operations/Finance': 'badge--draft',
    'System Administrator': 'badge--suspended',
  };
  const cls = colors[roleName] || 'badge--pending';
  return `<span class="badge ${cls}">${escapeHtml(roleName || '-')}</span>`;
}

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
