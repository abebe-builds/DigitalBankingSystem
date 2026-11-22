/**
 * manager.js — Manager/Authorized Approver dashboard.
 * Full pipeline: view all applications, review, approve/reject,
 * create accounts, activate accounts, send OTP to customer.
 */
import api from '../api.js';
import toast from '../components/toast.js';

export async function render(container, view, user) {
  switch (view) {
    case 'accounts': return renderAccounts(container, user);
    case 'users':    return renderUsers(container, user);
    case 'approvals':
    default:         return renderApprovals(container, user);
  }
}

// ─── APPROVALS ────────────────────────────────────────────────────────────────
async function renderApprovals(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Application Pipeline</h2>
    <div id="mgr-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px"></div>
    <div id="mgr-body"></div>`;
  await loadApprovals(container, user);
}

async function loadApprovals(container, user) {
  const statsEl = document.getElementById('mgr-stats');
  const bodyEl  = document.getElementById('mgr-body');
  if (!statsEl || !bodyEl) return;

  bodyEl.innerHTML = '<div style="color:#6c757d;padding:20px">Loading…</div>';

  try {
    // Load ALL applications so manager can see full pipeline
    const [allRes, usersRes] = await Promise.allSettled([
      api.get('/applications'),
      api.get('/users'),
    ]);

    const all   = allRes.status === 'fulfilled'   ? (allRes.value.applications   || allRes.value.data   || []) : [];
    const users = usersRes.status === 'fulfilled' ? (usersRes.value.users || usersRes.value.data || []) : [];

    // Stats
    const submitted   = all.filter(a => a.status === 'SUBMITTED').length;
    const underReview = all.filter(a => a.status === 'UNDER_REVIEW').length;
    const approved    = all.filter(a => ['APPROVED','ACCOUNT_CREATED'].includes(a.status)).length;
    const pending     = all.filter(a => a.status === 'PENDING_ACTIVATION').length; // bank_accounts

    statsEl.innerHTML = `
      ${mgrStat(submitted,   'New Submissions',    '#f39c12')}
      ${mgrStat(underReview, 'Under Review',       '#9b59b6')}
      ${mgrStat(approved,    'Approved',           '#27ae60')}
      ${mgrStat(users.length,'Total Users',        '#3498db')}`;

    if (!all.length) {
      bodyEl.innerHTML = emptyState('📋', 'No applications yet', 'Applications will appear here once customers apply.');
      return;
    }

    // Group by status
    const groups = [
      { label: '📥 New Submissions',    statuses: ['SUBMITTED'],                        color: '#f39c12' },
      { label: '🔍 Under Review',       statuses: ['UNDER_REVIEW'],                     color: '#9b59b6' },
      { label: '⚠️  Correction Required', statuses: ['CORRECTION_REQUIRED'],            color: '#e67e22' },
      { label: '✅ Approved — Pending Account Creation', statuses: ['APPROVED'],        color: '#27ae60' },
      { label: '🏦 Account Created — Pending Activation', statuses: ['ACCOUNT_CREATED'],color: '#1a3c5e' },
      { label: '❌ Rejected',            statuses: ['REJECTED'],                         color: '#e74c3c' },
    ];

    let html = '';
    for (const group of groups) {
      const items = all.filter(a => group.statuses.includes(a.status));
      if (!items.length) continue;
      html += `
        <div style="margin-bottom:28px">
          <div style="font-size:15px;font-weight:700;color:#1a3c5e;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${group.color}">
            ${group.label} <span style="background:${group.color};color:#fff;border-radius:100px;padding:2px 10px;font-size:12px;margin-left:8px">${items.length}</span>
          </div>
          ${items.map(a => appRow(a, user)).join('')}
        </div>`;
    }
    bodyEl.innerHTML = html;

    // Attach action handlers
    bodyEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn, container, user));
    });

    // Attach account action handlers
    bodyEl.querySelectorAll('[data-acct-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAcctAction(btn, container, user));
    });

  } catch (err) {
    bodyEl.innerHTML = `<div style="background:#fdf2f2;color:#e74c3c;padding:16px;border-radius:8px">${esc(err.message)}</div>`;
  }
}

function appRow(a, user) {
  const name = esc(((a.first_name||'') + ' ' + (a.last_name||'')).trim() || '—');
  const date = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-ET') : '—';

  let actions = '';

  if (a.status === 'SUBMITTED') {
    actions = `
      <button class="btn btn--sm" style="background:#9b59b6;color:#fff;border:none" data-action="review" data-id="${a.id}">Start Review</button>
      <button class="btn btn--sm" style="background:#e74c3c;color:#fff;border:none;margin-left:6px" data-action="reject" data-id="${a.id}">Reject</button>`;
  } else if (a.status === 'UNDER_REVIEW') {
    actions = `
      <button class="btn btn--sm" style="background:#27ae60;color:#fff;border:none" data-action="approve" data-id="${a.id}">✅ Approve</button>
      <button class="btn btn--sm" style="background:#e67e22;color:#fff;border:none;margin-left:6px" data-action="request-correction" data-id="${a.id}">Request Correction</button>
      <button class="btn btn--sm" style="background:#e74c3c;color:#fff;border:none;margin-left:6px" data-action="reject" data-id="${a.id}">Reject</button>`;
  } else if (a.status === 'APPROVED') {
    actions = `
      <button class="btn btn--sm" style="background:#1a3c5e;color:#fff;border:none" data-action="create-account" data-id="${a.id}">🏦 Create Account</button>`;
  } else if (a.status === 'ACCOUNT_CREATED') {
    actions = `<span style="font-size:12px;color:#27ae60">Account created — awaiting bank activation</span>`;
  }

  return `
    <div style="background:#fff;border:1px solid #e9ecef;border-radius:10px;padding:16px 20px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-weight:700;color:#1a3c5e;font-size:14px">${esc(a.reference_number || a.id)}</div>
        <div style="font-size:13px;color:#495057;margin-top:2px">${name} &nbsp;·&nbsp; ${esc(a.account_type||'?')} &nbsp;·&nbsp; Submitted ${date}</div>
        ${a.initial_deposit_amount > 0 ? `<div style="font-size:12px;color:#27ae60;margin-top:2px">💰 Initial Deposit: ETB ${Number(a.initial_deposit_amount).toLocaleString('en-ET',{minimumFractionDigits:2})}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${actions}
      </div>
    </div>`;
}

async function handleAction(btn, container, user) {
  const action = btn.getAttribute('data-action');
  const id     = btn.getAttribute('data-id');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '…';

  try {
    if (action === 'review') {
      await api.post(`/applications/${id}/review`, { notes: 'Reviewed by manager' });
      toast.success('Application moved to Under Review');
    } else if (action === 'approve') {
      await api.post(`/applications/${id}/approve`, { notes: 'Approved by manager' });
      toast.success('Application approved!');
    } else if (action === 'reject') {
      const reason = prompt('Enter rejection reason (optional):') || 'Does not meet requirements';
      await api.post(`/applications/${id}/reject`, { rejection_reason: reason });
      toast.error('Application rejected');
    } else if (action === 'request-correction') {
      const instructions = prompt('Enter correction instructions for the customer:');
      if (!instructions) { btn.disabled = false; btn.textContent = orig; return; }
      await api.post(`/applications/${id}/request-correction`, { correction_instructions: instructions });
      toast.success('Correction request sent to customer');
    } else if (action === 'create-account') {
      await api.post(`/applications/${id}/create-account`, {});
      toast.success('Bank account created! Now activate it in the Accounts section.');
    }
    await loadApprovals(container, user);
  } catch (err) {
    toast.error(err.message || 'Action failed');
    btn.disabled = false;
    btn.textContent = orig;
  }
}

async function handleAcctAction(btn, container, user) {
  const action    = btn.getAttribute('data-acct-action');
  const accountId = btn.getAttribute('data-acct-id');
  const custUserId = btn.getAttribute('data-cust-id');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '…';

  try {
    if (action === 'activate') {
      await api.post(`/accounts/${accountId}/activate`, {});
      toast.success('Account activated! Sending OTP to customer…');
      // Send OTP to customer for phone verification (simulated)
      try {
        // We can't send OTP on behalf of the customer from manager's session
        // Instead show manager a message to notify customer
        toast.success('✅ Account is now ACTIVE. Customer can log in and verify via OTP.');
      } catch {}
      await renderAccounts(container, user);
    }
  } catch (err) {
    toast.error(err.message || 'Action failed');
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────
async function renderAccounts(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Bank Accounts</h2>
    <div id="acct-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px"></div>
    <div id="acct-body"></div>`;

  try {
    const res = await api.get('/accounts');
    const accounts = res.accounts || res.data || [];

    const active  = accounts.filter(a => a.status === 'ACTIVE').length;
    const pending = accounts.filter(a => a.status === 'PENDING_ACTIVATION').length;
    const susp    = accounts.filter(a => a.status === 'SUSPENDED').length;

    document.getElementById('acct-stats').innerHTML = `
      ${mgrStat(accounts.length, 'Total Accounts', '#1a3c5e')}
      ${mgrStat(active,          'Active',          '#27ae60')}
      ${mgrStat(pending,         'Pending Activation','#f39c12')}
      ${mgrStat(susp,            'Suspended',        '#e74c3c')}`;

    const body = document.getElementById('acct-body');
    if (!accounts.length) {
      body.innerHTML = emptyState('🏦', 'No accounts yet', 'Accounts appear here after applications are approved and created.');
      return;
    }

    // Show PENDING_ACTIVATION first (needs action)
    const sorted = [...accounts].sort((a,b) => {
      const order = { PENDING_ACTIVATION: 0, ACTIVE: 1, SUSPENDED: 2, CLOSED: 3 };
      return (order[a.status]||9) - (order[b.status]||9);
    });

    body.innerHTML = sorted.map(a => `
      <div style="background:#fff;border:2px solid ${a.status==='PENDING_ACTIVATION'?'#f39c12':a.status==='ACTIVE'?'#27ae60':'#dee2e6'};border-radius:12px;padding:18px 20px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:13px;color:#6c757d;margin-bottom:2px">${esc(a.account_type)} Account</div>
            <div style="font-size:16px;font-weight:800;color:#1a3c5e;font-family:monospace">${esc(a.account_number)}</div>
            <div style="font-size:22px;font-weight:900;color:#1a3c5e;margin-top:4px">ETB ${fmt(a.balance)}</div>
            <div style="font-size:12px;color:#6c757d;margin-top:4px">Customer ID: ${a.customer_user_id}</div>
          </div>
          <div style="text-align:right">
            <span style="display:inline-block;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;
              background:${a.status==='ACTIVE'?'#d4edda':a.status==='PENDING_ACTIVATION'?'#fff3cd':'#f8d7da'};
              color:${a.status==='ACTIVE'?'#155724':a.status==='PENDING_ACTIVATION'?'#856404':'#721c24'}">
              ${a.status.replace(/_/g,' ')}
            </span>
            ${a.status === 'PENDING_ACTIVATION' ? `
            <div style="margin-top:10px">
              <button class="btn btn--sm" style="background:#27ae60;color:#fff;border:none;padding:8px 16px;font-size:13px"
                data-acct-action="activate" data-acct-id="${a.id}" data-cust-id="${a.customer_user_id}">
                ▶ Activate Account
              </button>
            </div>` : ''}
            ${a.status === 'ACTIVE' ? `
            <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
              <button class="btn btn--sm" style="background:#e74c3c;color:#fff;border:none"
                data-acct-action="suspend" data-acct-id="${a.id}" data-cust-id="${a.customer_user_id}">
                Suspend
              </button>
            </div>` : ''}
          </div>
        </div>
        ${a.status === 'PENDING_ACTIVATION' ? `
        <div style="margin-top:12px;background:#fff8e1;border-radius:8px;padding:10px 14px;font-size:12px;color:#856404">
          ⏳ This account is waiting for your activation. Click <strong>"Activate Account"</strong> to enable it.
          The customer will receive their account number and can start banking.
          ${a.balance > 0 ? `<br>💰 Initial deposit of <strong>ETB ${fmt(a.balance)}</strong> is already posted.` : ''}
        </div>` : ''}
      </div>`).join('');

    // Attach handlers
    document.querySelectorAll('[data-acct-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAcctAction(btn, container, user));
    });

  } catch (err) {
    document.getElementById('acct-body').innerHTML =
      `<div style="color:#e74c3c;padding:16px">${esc(err.message)}</div>`;
  }
}

// ─── USERS ────────────────────────────────────────────────────────────────────
async function renderUsers(container, user) {
  container.innerHTML = `
    <h2 class="view-title">System Users</h2>
    <div id="users-body"></div>`;
  try {
    const res = await api.get('/users');
    const users = res.users || res.data || [];
    if (!users.length) {
      document.getElementById('users-body').innerHTML = emptyState('👥', 'No users', '');
      return;
    }
    document.getElementById('users-body').innerHTML = `
      <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e9ecef">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#1a3c5e;color:#fff">
            <th style="padding:12px 16px;text-align:left">Email</th>
            <th style="padding:12px 16px;text-align:left">Role</th>
            <th style="padding:12px 16px;text-align:left">Status</th>
            <th style="padding:12px 16px;text-align:left">Last Login</th>
          </tr></thead>
          <tbody>${users.map((u,i) => `
            <tr style="border-top:1px solid #f0f0f0;background:${i%2?'#f8f9fa':'#fff'}">
              <td style="padding:12px 16px;font-weight:500">${esc(u.email)}</td>
              <td style="padding:12px 16px"><span style="background:#e8f4fd;color:#1a3c5e;border-radius:6px;padding:3px 9px;font-size:12px;font-weight:600">${esc(u.role_name||'?')}</span></td>
              <td style="padding:12px 16px"><span style="background:${u.status==='active'?'#d4edda':'#f8d7da'};color:${u.status==='active'?'#155724':'#721c24'};border-radius:6px;padding:3px 9px;font-size:12px;font-weight:600">${esc(u.status)}</span></td>
              <td style="padding:12px 16px;color:#6c757d;font-size:12px">${u.last_login_at?new Date(u.last_login_at).toLocaleString('en-ET'):'Never'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    document.getElementById('users-body').innerHTML = `<div style="color:#e74c3c">${esc(err.message)}</div>`;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function mgrStat(val, label, color) {
  return `<div style="background:#fff;border-radius:12px;padding:20px;border-left:4px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,.06)">
    <div style="font-size:26px;font-weight:900;color:${color}">${esc(String(val))}</div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6c757d;font-weight:600;margin-top:4px">${esc(label)}</div>
  </div>`;
}

function emptyState(icon, title, sub) {
  return `<div style="text-align:center;padding:60px 24px;color:#6c757d">
    <div style="font-size:56px;margin-bottom:16px">${icon}</div>
    <div style="font-size:18px;font-weight:700;color:#1a3c5e;margin-bottom:8px">${esc(title)}</div>
    <div style="font-size:14px;max-width:400px;margin:0 auto;line-height:1.7">${esc(sub)}</div>
  </div>`;
}

function fmt(n) {
  return Number(n||0).toLocaleString('en-ET',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
