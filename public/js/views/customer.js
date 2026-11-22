/**
 * customer.js — Customer dashboard views.
 * Views: accounts, applications, transfer, otp, profile
 */
import api from '../api.js';
import toast from '../components/toast.js';

export async function render(container, view, user) {
  switch (view) {
    case 'applications': return renderApplications(container, user);
    case 'transfer':     return renderTransfer(container, user);
    case 'otp':          return renderOTP(container, user);
    case 'profile':      return renderProfile(container, user);
    case 'accounts':
    default:             return renderAccounts(container, user);
  }
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────
async function renderAccounts(container, user) {
  container.innerHTML = `
    <h2 class="view-title">My Accounts</h2>
    <div id="stat-grid" class="stat-grid"></div>
    <div id="accounts-body"></div>`;

  try {
    const res = await api.get('/accounts/my');
    const accounts = res.data || [];

    const totalBalance  = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    const activeCount   = accounts.filter(a => a.status === 'ACTIVE').length;
    const pendingCount  = accounts.filter(a => a.status === 'PENDING_ACTIVATION').length;
    const lastLogin     = user.last_login_at
      ? new Date(user.last_login_at).toLocaleString('en-ET') : 'N/A';

    document.getElementById('stat-grid').innerHTML = `
      ${stat('ETB ' + fmt(totalBalance), 'Total Balance', '#1a3c5e')}
      ${stat(activeCount,  'Active Accounts', '#27ae60')}
      ${stat(pendingCount, 'Pending Activation', '#f39c12')}
      ${stat(lastLogin,    'Last Login', '#3498db')}`;

    const body = document.getElementById('accounts-body');
    if (!accounts.length) {
      body.innerHTML = emptyState('🏦', 'No accounts yet',
        'Your account will appear here once your application is approved and activated by the bank.');
      return;
    }

    body.innerHTML = accounts.map(a => `
      <div class="card" style="margin-bottom:16px;border-left:4px solid ${statusColor(a.status)}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:13px;color:#6c757d;margin-bottom:4px">${esc(a.account_type)} Account</div>
            <div style="font-size:20px;font-weight:800;color:#1a3c5e">${esc(a.account_number)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:24px;font-weight:900;color:#1a3c5e">ETB ${fmt(a.balance)}</div>
            <span class="badge ${badgeClass(a.status)}">${esc(a.status.replace('_',' '))}</span>
          </div>
        </div>
        ${a.status === 'ACTIVE' ? `
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn--primary btn--sm" onclick="location.hash='transfer'">Transfer</button>
          <button class="btn btn--outline btn--sm" onclick="viewTxns(${a.id},this)">View Transactions</button>
        </div>` : a.status === 'PENDING_ACTIVATION' ? `
        <div style="margin-top:12px;background:#fff8e1;border-radius:8px;padding:12px 14px;font-size:13px;color:#856404">
          ⏳ Your account is pending activation by the bank. You will be notified once it is active.
        </div>` : ''}
        <div id="txn-${a.id}" style="margin-top:16px"></div>
      </div>`).join('');

  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

window.viewTxns = async function(accountId, btn) {
  const el = document.getElementById('txn-' + accountId);
  if (el.dataset.loaded) { 
    el.innerHTML = ''; 
    el.dataset.loaded = ''; 
    btn.textContent = 'View Transactions'; 
    return; 
  }
  btn.textContent = 'Loading…';
  try {
    const res = await api.get('/transactions', { accountId, limit: 10 });
    const txns = res.data || [];
    if (!txns.length) { 
      el.innerHTML = '<p style="color:#6c757d;font-size:13px;padding:12px">No transactions yet.</p>'; 
    } else {
      el.innerHTML = `
        <div style="overflow-x:auto;margin-top:12px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f4f6f9">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Reference</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Type</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600">Amount (ETB)</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Status</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Date</th>
            </tr></thead>
            <tbody>${txns.map(t => `
              <tr style="border-top:1px solid #f0f0f0">
                <td style="padding:8px 12px;font-family:monospace">${esc(t.reference_number)}</td>
                <td style="padding:8px 12px">${esc(t.transaction_type.replace(/_/g,' '))}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:${t.transaction_type.includes('DEBIT')||t.transaction_type==='WITHDRAWAL'?'#e74c3c':'#27ae60'}">
                  ${t.transaction_type.includes('DEBIT')||t.transaction_type==='WITHDRAWAL'?'-':'+'}${fmt(t.amount)}
                </td>
                <td style="padding:8px 12px"><span class="badge ${badgeClass(t.status)}">${esc(t.status)}</span></td>
                <td style="padding:8px 12px;color:#6c757d">${new Date(t.created_at).toLocaleDateString('en-ET')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
    el.dataset.loaded = '1';
    btn.textContent = 'Hide Transactions';
  } catch (err) { 
    console.error('Failed to load transactions:', err);
    el.innerHTML = `<p style="color:#e74c3c;font-size:13px;padding:12px">❌ Error loading transactions: ${err.message || 'Unknown error'}</p>`;
    btn.textContent = 'View Transactions'; 
  }
};

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────
async function renderApplications(container, user) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <h2 class="view-title" style="margin:0">My Applications</h2>
      <button id="new-app-btn" class="btn btn--primary">+ New Application</button>
    </div>
    <div id="apps-body"></div>`;

  document.getElementById('new-app-btn').addEventListener('click', () => showNewAppForm(loadApps));

  async function loadApps() {
    const body = document.getElementById('apps-body');
    if (!body) return;
    body.innerHTML = '<div style="color:#6c757d;padding:16px">Loading…</div>';
    try {
      const res = await api.get('/applications');
      const apps = res.applications || res.data || [];
      if (!apps.length) {
        body.innerHTML = emptyState('📋', 'No applications yet',
          'Click "+ New Application" to apply for a bank account.');
        return;
      }
      body.innerHTML = apps.map(a => applicationCard(a)).join('');
    } catch (err) {
      body.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }
  await loadApps();
}

function applicationCard(a) {
  const steps = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','ACCOUNT_CREATED'];
  const currentStep = steps.indexOf(a.status);
  const stepLabels  = ['Draft','Submitted','Under Review','Approved','Account Created'];

  const timeline = steps.map((s, i) => `
    <div style="display:flex;align-items:center;gap:6px;flex:1;${i < steps.length-1 ? 'min-width:80px' : ''}">
      <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:13px;font-weight:700;flex-shrink:0;
        background:${i <= currentStep ? '#1a3c5e' : '#e9ecef'};
        color:${i <= currentStep ? '#fff' : '#adb5bd'}">
        ${i < currentStep ? '✓' : i + 1}
      </div>
      ${i < steps.length - 1 ? `<div style="flex:1;height:2px;background:${i < currentStep ? '#1a3c5e' : '#e9ecef'}"></div>` : ''}
    </div>`).join('');

  const statusMessages = {
    DRAFT:          { icon:'✏️', color:'#6c757d', msg:'Your application is saved as a draft. Complete and submit it.' },
    SUBMITTED:      { icon:'📤', color:'#3498db', msg:'Your application has been submitted and is awaiting review by our team.' },
    UNDER_REVIEW:   { icon:'🔍', color:'#9b59b6', msg:'Our team is currently reviewing your application and verifying your documents.' },
    CORRECTION_REQUIRED: { icon:'⚠️', color:'#f39c12', msg:'Correction required: ' + (a.correction_instructions || 'Please update your application.') },
    APPROVED:       { icon:'✅', color:'#27ae60', msg:'Your application is approved! We are creating your account now.' },
    REJECTED:       { icon:'❌', color:'#e74c3c', msg:'Application rejected: ' + (a.rejection_reason || 'Contact support for details.') },
    ACCOUNT_CREATED:{ icon:'🎉', color:'#27ae60', msg:'Your account has been created and will be activated shortly.' },
  };
  const info = statusMessages[a.status] || { icon:'📋', color:'#6c757d', msg:'' };

  return `
    <div class="card" style="margin-bottom:20px;border-top:4px solid ${info.color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div>
          <div style="font-weight:800;font-size:16px;color:#1a3c5e">${esc(a.reference_number)}</div>
          <div style="font-size:13px;color:#6c757d">Type: ${esc(a.account_type)} &nbsp;·&nbsp; Applicant: ${esc((a.first_name||'')+' '+(a.last_name||''))}</div>
          <div style="font-size:12px;color:#adb5bd;margin-top:2px">Submitted: ${a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-ET') : '—'}</div>
        </div>
        <span class="badge ${badgeClass(a.status)}">${esc(a.status.replace(/_/g,' '))}</span>
      </div>

      <!-- Status message -->
      <div style="background:#f8f9fa;border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
        <span style="font-size:20px">${info.icon}</span>
        <div style="font-size:13px;color:#495057;line-height:1.6">${esc(info.msg)}</div>
      </div>

      <!-- Timeline (only for non-rejected/non-correction) -->
      ${!['REJECTED','CORRECTION_REQUIRED'].includes(a.status) ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Application Progress</div>
        <div style="display:flex;align-items:center">${timeline}</div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          ${stepLabels.map((l,i) => `<div style="font-size:10px;text-align:center;flex:1;color:${i<=currentStep?'#1a3c5e':'#adb5bd'};font-weight:${i===currentStep?'700':'400'}">${l}</div>`).join('')}
        </div>
      </div>` : ''}

      ${a.status === 'CORRECTION_REQUIRED' ? `
        <button class="btn btn--primary btn--sm" onclick="window.updateApplicationById(${a.id})">Update Application</button>` : ''}
    </div>`;
}

async function showNewAppForm(onSuccess) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div style="font-size:20px;font-weight:800;color:#1a3c5e">📋 New Account Application</div>
        <button id="close-app-modal" style="background:none;border:none;font-size:22px;cursor:pointer;color:#6c757d">✕</button>
      </div>
      <div id="app-err" style="display:none;background:#fdf2f2;color:#e74c3c;border-left:4px solid #e74c3c;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:span 2"><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Account Type *</label>
          <select id="na-type" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px">
            <option value="SAVINGS">💰 Savings Account</option>
            <option value="CHECKING">💼 Checking Account</option>
            <option value="FIXED_DEPOSIT">📈 Fixed Deposit</option>
          </select></div>
        <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">First Name *</label>
          <input id="na-fn" placeholder="Abebe" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Last Name *</label>
          <input id="na-ln" placeholder="Kebede" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Phone *</label>
          <input id="na-phone" placeholder="+251911000000" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Date of Birth *</label>
          <input id="na-dob" type="date" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div style="grid-column:span 2"><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">National ID *</label>
          <input id="na-nid" placeholder="ET-1234567890" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div style="grid-column:span 2"><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Address *</label>
          <input id="na-addr" placeholder="Bole Road, Addis Ababa" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">City *</label>
          <input id="na-city" placeholder="Addis Ababa" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Initial Deposit (ETB)</label>
          <input id="na-dep" type="number" min="0" step="0.01" placeholder="500.00" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;margin:16px 0">
        <input type="checkbox" id="na-terms" style="margin-top:3px;flex-shrink:0"/>
        <label for="na-terms" style="font-size:13px;color:#495057;cursor:pointer">I confirm all information is accurate and I agree to the Terms & Conditions.</label>
      </div>
      <div style="display:flex;gap:12px;margin-top:8px">
        <button id="na-cancel" class="btn btn--outline" style="color:#1a3c5e;border-color:#dee2e6;flex:1">Cancel</button>
        <button id="na-submit" class="btn btn--primary" style="flex:2">Submit Application</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#close-app-modal').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#na-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#na-submit').addEventListener('click', async () => {
    const errEl = overlay.querySelector('#app-err');
    errEl.style.display = 'none';
    const first = overlay.querySelector('#na-fn').value.trim();
    const last  = overlay.querySelector('#na-ln').value.trim();
    const phone = overlay.querySelector('#na-phone').value.trim();
    const dob   = overlay.querySelector('#na-dob').value;
    const nid   = overlay.querySelector('#na-nid').value.trim();
    const addr  = overlay.querySelector('#na-addr').value.trim();
    const city  = overlay.querySelector('#na-city').value.trim();
    const terms = overlay.querySelector('#na-terms').checked;
    const missing = [];
    if (!first) missing.push('First Name');
    if (!last)  missing.push('Last Name');
    if (!phone) missing.push('Phone');
    if (!dob)   missing.push('Date of Birth');
    if (!nid)   missing.push('National ID');
    if (!addr)  missing.push('Address');
    if (!city)  missing.push('City');
    if (!terms) { errEl.textContent = 'You must accept the Terms & Conditions.'; errEl.style.display='block'; return; }
    if (missing.length) { errEl.textContent = 'Required: ' + missing.join(', '); errEl.style.display='block'; return; }
    const btn = overlay.querySelector('#na-submit');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const res = await api.post('/applications', {
        account_type: overlay.querySelector('#na-type').value,
        first_name: first, last_name: last, phone, date_of_birth: dob,
        national_id: nid, address_line1: addr, city,
        initial_deposit_amount: parseFloat(overlay.querySelector('#na-dep').value)||0,
        currency:'ETB', terms_accepted:1, privacy_accepted:1,
        nationality:'Ethiopian',
      });
      const appId = res.application?.id;
      if (appId) await api.post('/applications/' + appId + '/submit', {});
      toast.success('Application submitted successfully!');
      overlay.remove();
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      errEl.textContent = err.message || 'Submission failed.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Submit Application';
    }
  });
}

// Update application form (for CORRECTION_REQUIRED status)
window.updateApplicationById = async function(appId) {
  // First, fetch the existing application data
  try {
    const res = await api.get(`/applications/${appId}`);
    const app = res.application || res.data || {};
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div style="font-size:20px;font-weight:800;color:#1a3c5e">✏️ Update Application</div>
          <button id="close-update-modal" style="background:none;border:none;font-size:22px;cursor:pointer;color:#6c757d">✕</button>
        </div>
        
        <!-- Correction Instructions -->
        ${app.correction_instructions ? `
        <div style="background:#fff8e1;border-left:4px solid #f39c12;border-radius:8px;padding:14px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:600;color:#856404;margin-bottom:6px">⚠️ Correction Required</div>
          <div style="font-size:13px;color:#856404;line-height:1.6">${escapeHtml(app.correction_instructions)}</div>
        </div>` : ''}
        
        <div id="update-err" style="display:none;background:#fdf2f2;color:#e74c3c;border-left:4px solid #e74c3c;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px"></div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="grid-column:span 2"><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Account Type *</label>
            <select id="upd-type" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px">
              <option value="SAVINGS" ${app.account_type==='SAVINGS'?'selected':''}>💰 Savings Account</option>
              <option value="CHECKING" ${app.account_type==='CHECKING'?'selected':''}>💼 Checking Account</option>
              <option value="FIXED_DEPOSIT" ${app.account_type==='FIXED_DEPOSIT'?'selected':''}>📈 Fixed Deposit</option>
            </select></div>
          <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">First Name *</label>
            <input id="upd-fn" value="${escapeHtml(app.first_name||'')}" placeholder="Abebe" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Last Name *</label>
            <input id="upd-ln" value="${escapeHtml(app.last_name||'')}" placeholder="Kebede" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Phone *</label>
            <input id="upd-phone" value="${escapeHtml(app.phone||'')}" placeholder="+251911000000" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Date of Birth *</label>
            <input id="upd-dob" type="date" value="${app.date_of_birth?app.date_of_birth.slice(0,10):''}" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div style="grid-column:span 2"><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">National ID *</label>
            <input id="upd-nid" value="${escapeHtml(app.national_id||'')}" placeholder="ET-1234567890" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div style="grid-column:span 2"><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Address *</label>
            <input id="upd-addr" value="${escapeHtml(app.address_line1||'')}" placeholder="Bole Road, Addis Ababa" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">City *</label>
            <input id="upd-city" value="${escapeHtml(app.city||'')}" placeholder="Addis Ababa" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
          <div><label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:5px">Initial Deposit (ETB)</label>
            <input id="upd-dep" type="number" min="0" step="0.01" value="${app.initial_deposit_amount||''}" placeholder="500.00" style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"/></div>
        </div>
        
        <div style="display:flex;gap:12px;margin-top:20px">
          <button id="upd-cancel" class="btn btn--outline" style="color:#1a3c5e;border-color:#dee2e6;flex:1">Cancel</button>
          <button id="upd-submit" class="btn btn--primary" style="flex:2">Update & Resubmit</button>
        </div>
      </div>`;
    
    document.body.appendChild(overlay);
    
    function closeModal() {
      overlay.remove();
    }
    
    overlay.querySelector('#close-update-modal').addEventListener('click', closeModal);
    overlay.querySelector('#upd-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    overlay.querySelector('#upd-submit').addEventListener('click', async () => {
      const errEl = overlay.querySelector('#update-err');
      errEl.style.display = 'none';
      
      const first = overlay.querySelector('#upd-fn').value.trim();
      const last  = overlay.querySelector('#upd-ln').value.trim();
      const phone = overlay.querySelector('#upd-phone').value.trim();
      const dob   = overlay.querySelector('#upd-dob').value;
      const nid   = overlay.querySelector('#upd-nid').value.trim();
      const addr  = overlay.querySelector('#upd-addr').value.trim();
      const city  = overlay.querySelector('#upd-city').value.trim();
      
      const missing = [];
      if (!first) missing.push('First Name');
      if (!last)  missing.push('Last Name');
      if (!phone) missing.push('Phone');
      if (!dob)   missing.push('Date of Birth');
      if (!nid)   missing.push('National ID');
      if (!addr)  missing.push('Address');
      if (!city)  missing.push('City');
      if (missing.length) { 
        errEl.textContent = 'Required fields: ' + missing.join(', '); 
        errEl.style.display='block'; 
        return; 
      }
      
      const btn = overlay.querySelector('#upd-submit');
      btn.disabled = true; 
      btn.textContent = 'Updating…';
      
      try {
        // Update the application
        await api.put(`/applications/${appId}`, {
          account_type: overlay.querySelector('#upd-type').value,
          first_name: first,
          last_name: last,
          phone,
          date_of_birth: dob,
          national_id: nid,
          address_line1: addr,
          city,
          initial_deposit_amount: parseFloat(overlay.querySelector('#upd-dep').value) || 0,
          currency: 'ETB',
        });
        
        // Resubmit the application
        await api.post(`/applications/${appId}/submit`, {});
        
        toast.success('Application updated and resubmitted successfully!');
        closeModal();
        
        // Reload the page to show updated status
        location.reload();
      } catch (err) {
        errEl.textContent = err.message || 'Update failed.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Update & Resubmit';
      }
    });
    
  } catch (err) {
    toast.error('Failed to load application: ' + err.message);
  }
};

// Helper function for escaping HTML in template
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── OTP VERIFICATION ─────────────────────────────────────────────────────────
async function renderOTP(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Account Verification</h2>
    <div class="card" style="max-width:480px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:12px">📱</div>
        <div style="font-size:18px;font-weight:700;color:#1a3c5e;margin-bottom:8px">Verify Your Account</div>
        <div style="font-size:14px;color:#6c757d;line-height:1.7">
          Verify your phone number or email address to secure your account.
          A 6-digit one-time password (OTP) will be sent to your contact.
        </div>
      </div>

      <div id="otp-send-section">
        <div style="margin-bottom:16px">
          <label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:8px">Verification Type</label>
          <div style="display:flex;gap:10px">
            <label style="flex:1;border:2px solid #dee2e6;border-radius:10px;padding:12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:border-color .2s" id="lbl-phone">
              <input type="radio" name="otp-purpose" value="PHONE_VERIFICATION" style="accent-color:#1a3c5e" checked />
              <span style="font-size:13px;font-weight:600">📞 Phone Number</span>
            </label>
            <label style="flex:1;border:2px solid #dee2e6;border-radius:10px;padding:12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:border-color .2s" id="lbl-email">
              <input type="radio" name="otp-purpose" value="EMAIL_VERIFICATION" style="accent-color:#1a3c5e" />
              <span style="font-size:13px;font-weight:600">📧 Email Address</span>
            </label>
          </div>
        </div>

        <div id="otp-send-err" style="display:none;background:#fdf2f2;color:#e74c3c;border-left:4px solid #e74c3c;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px"></div>

        <button id="otp-send-btn" class="btn btn--primary" style="width:100%;padding:13px">
          Send OTP Code
        </button>

        <div style="background:#e8f4fd;border-radius:8px;padding:12px 14px;margin-top:14px;font-size:12px;color:#1a3c5e;line-height:1.7">
          ⏰ OTP codes expire in <strong>10 minutes</strong> and can only be used once.<br>
          🔒 In a production system, the OTP is delivered via SMS or email gateway.<br>
          📱 <strong>Demo mode:</strong> Your OTP will appear on screen after clicking Send.
        </div>
      </div>

      <div id="otp-verify-section" style="display:none;margin-top:20px">
        <!-- Simulated SMS / Email delivery display -->
        <div id="otp-display" style="display:none;margin-bottom:16px"></div>

        <label style="font-size:13px;font-weight:600;color:#1a3c5e;display:block;margin-bottom:8px">Enter 6-Digit OTP Code</label>
        <input id="otp-input" maxlength="6" placeholder="000000"
          style="width:100%;padding:14px;border:2px solid #dee2e6;border-radius:10px;font-size:28px;font-weight:800;text-align:center;letter-spacing:10px;font-family:monospace;color:#1a3c5e"/>
        <div id="otp-verify-err" style="display:none;background:#fdf2f2;color:#e74c3c;border-left:4px solid #e74c3c;border-radius:8px;padding:12px;margin:12px 0;font-size:13px"></div>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button id="otp-resend-btn" class="btn btn--outline" style="flex:1;color:#1a3c5e;border-color:#dee2e6">🔄 Resend Code</button>
          <button id="otp-verify-btn" class="btn btn--primary" style="flex:2">✔ Verify OTP</button>
        </div>
      </div>

      <div id="otp-success-section" style="display:none;text-align:center;padding:24px 0">
        <div style="font-size:56px;margin-bottom:12px">✅</div>
        <div style="font-size:18px;font-weight:800;color:#27ae60;margin-bottom:8px">Verified Successfully!</div>
        <div style="font-size:14px;color:#6c757d;margin-bottom:20px">Your account has been verified. You can now use all banking services.</div>
        <button class="btn btn--primary" onclick="location.hash='accounts'">Go to My Accounts</button>
      </div>
    </div>`;

  let currentPurpose = 'PHONE_VERIFICATION';

  // Radio style update
  container.querySelectorAll('input[name="otp-purpose"]').forEach(radio => {
    radio.addEventListener('change', () => {
      currentPurpose = radio.value;
      document.getElementById('lbl-phone').style.borderColor = currentPurpose === 'PHONE_VERIFICATION' ? '#1a3c5e' : '#dee2e6';
      document.getElementById('lbl-email').style.borderColor = currentPurpose === 'EMAIL_VERIFICATION' ? '#1a3c5e' : '#dee2e6';
    });
  });

  // Send OTP
  document.getElementById('otp-send-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('otp-send-err');
    errEl.style.display = 'none';
    const btn = document.getElementById('otp-send-btn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await api.post('/otp/send', { purpose: currentPurpose });

      // Show the OTP delivery simulation
      const verifySection = document.getElementById('otp-verify-section');
      const otpDisplay    = document.getElementById('otp-display');
      const isPhone = currentPurpose === 'PHONE_VERIFICATION';

      if (res.dev_otp) {
        // Dev mode: show simulated SMS/email with the code
        otpDisplay.innerHTML = `
          <div style="margin-bottom:16px">
            <!-- Simulated SMS/Email notification -->
            <div style="background:${isPhone ? '#1a1a1a' : '#f0f4ff'};border-radius:12px;padding:16px 18px;${isPhone ? 'color:#fff;' : 'border:1px solid #c7d7fc;'}">
              ${isPhone ? `
              <!-- Phone SMS style -->
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <div style="width:32px;height:32px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>
                <div>
                  <div style="font-size:12px;opacity:.7">DigitalBank ETB</div>
                  <div style="font-size:11px;opacity:.5">SMS Message</div>
                </div>
                <div style="margin-left:auto;font-size:11px;opacity:.5">Just now</div>
              </div>
              <div style="font-size:14px;line-height:1.7;opacity:.9">
                Your DigitalBank ETB verification code is:<br>
                <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#f0a500;display:block;margin:10px 0">${res.dev_otp}</span>
                Valid for 10 minutes. Do not share this code with anyone.
              </div>` : `
              <!-- Email style -->
              <div style="border-bottom:2px solid #e0e7ff;padding-bottom:10px;margin-bottom:12px">
                <div style="font-size:13px;font-weight:700;color:#1a3c5e">📧 From: noreply@digitalbank.et</div>
                <div style="font-size:12px;color:#6c757d">Subject: Your DigitalBank ETB Verification Code</div>
              </div>
              <div style="font-size:13px;color:#1a1a2e;line-height:1.8">
                Dear Customer,<br><br>
                Your email verification code is:
                <div style="text-align:center;margin:14px 0">
                  <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#1a3c5e;display:inline-block;background:#f0f4ff;padding:12px 24px;border-radius:10px;border:2px dashed #1a3c5e">${res.dev_otp}</span>
                </div>
                This code expires in <strong>10 minutes</strong>. Do not share it with anyone.<br><br>
                If you did not request this, please contact support immediately.
              </div>`}
            </div>
            <div style="text-align:center;margin-top:8px;font-size:11px;color:#adb5bd;font-style:italic">
              ⚠️ Simulation mode — in production this would be delivered via ${isPhone ? 'SMS to your phone' : 'email to your inbox'}
            </div>
          </div>`;
        otpDisplay.style.display = 'block';
        // Auto-fill the OTP input for convenience in demo
        document.getElementById('otp-input').value = res.dev_otp;
      } else {
        // Production mode: OTP was sent via real gateway
        otpDisplay.innerHTML = `
          <div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;border-left:4px solid #27ae60;font-size:13px;color:#155724">
            ✅ OTP sent to your ${isPhone ? 'registered phone number' : 'registered email address'}.
            Please check and enter the 6-digit code below.
          </div>`;
        otpDisplay.style.display = 'block';
      }

      verifySection.style.display = 'block';
      btn.textContent = 'Resend OTP';
      btn.disabled = false;
    } catch (err) {
      errEl.textContent = err.message || 'Failed to send OTP.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Send OTP Code';
    }
  });

  // Resend OTP
  document.getElementById('otp-resend-btn').addEventListener('click', async () => {
    const btn = document.getElementById('otp-resend-btn');
    btn.disabled = true; btn.textContent = '⏳ Sending…';
    try {
      const res = await api.post('/otp/send', { purpose: currentPurpose });
      if (res.dev_otp) {
        const isPhone = currentPurpose === 'PHONE_VERIFICATION';
        const otpDisplay = document.getElementById('otp-display');
        otpDisplay.innerHTML = `
          <div style="background:${isPhone?'#1a1a1a':'#f0f4ff'};border-radius:12px;padding:16px 18px;${isPhone?'color:#fff;':'border:1px solid #c7d7fc;'}">
            <div style="font-size:13px;${isPhone?'opacity:.8':'color:#495057;'}">New code for ${isPhone?'📞 SMS':'📧 Email'}:</div>
            <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:${isPhone?'#f0a500':'#1a3c5e'};margin:10px 0;text-align:center">${res.dev_otp}</div>
            <div style="font-size:11px;${isPhone?'opacity:.6':'color:#6c757d;'}">Expires in 10 minutes</div>
          </div>
          <div style="text-align:center;margin-top:6px;font-size:11px;color:#adb5bd;font-style:italic">⚠️ Simulation — in production sent via ${isPhone?'SMS':'email'}</div>`;
        otpDisplay.style.display = 'block';
        document.getElementById('otp-input').value = res.dev_otp;
      }
      toast.success('New OTP sent!');
      btn.textContent = '🔄 Resend Code';
      btn.disabled = false;
    } catch (err) {
      toast.error(err.message || 'Failed to resend.');
      btn.textContent = '🔄 Resend Code';
      btn.disabled = false;
    }
  });

  // Verify OTP
  document.getElementById('otp-verify-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('otp-verify-err');
    errEl.style.display = 'none';
    const token = document.getElementById('otp-input').value.trim();
    if (token.length !== 6) {
      errEl.textContent = 'Please enter the 6-digit OTP code.';
      errEl.style.display = 'block'; return;
    }
    const btn = document.getElementById('otp-verify-btn');
    btn.disabled = true; btn.textContent = 'Verifying…';
    try {
      const res = await api.post('/otp/verify', { purpose: currentPurpose, token });
      if (res.valid) {
        document.getElementById('otp-verify-section').style.display = 'none';
        document.getElementById('otp-send-section').style.display = 'none';
        document.getElementById('otp-success-section').style.display = 'block';
        toast.success('OTP verified successfully!');
      } else {
        errEl.textContent = res.reason || 'Invalid or expired OTP. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Verify OTP';
      }
    } catch (err) {
      errEl.textContent = err.message || 'Verification failed.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Verify OTP';
    }
  });

  // Auto-format OTP input (digits only)
  document.getElementById('otp-input').addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
  });
}

// ─── TRANSFER ─────────────────────────────────────────────────────────────────
async function renderTransfer(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Transfer Funds</h2>
    <div class="card" style="max-width:500px">
      <form id="transfer-form">
        <div class="form-group">
          <label class="form-label">From Account</label>
          <select id="t-from" class="form-control" required>
            <option value="">Loading accounts…</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">To Account ID</label>
          <input id="t-to" class="form-control" placeholder="Destination account ID" required />
        </div>
        <div class="form-group">
          <label class="form-label">Amount (ETB)</label>
          <input id="t-amount" type="number" class="form-control" min="1" step="0.01" placeholder="0.00" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input id="t-desc" class="form-control" placeholder="Optional — payment reference" />
        </div>
        <div id="transfer-err" style="display:none;background:#fdf2f2;color:#e74c3c;border-left:4px solid #e74c3c;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px"></div>
        <div id="transfer-ok" style="display:none;background:#f0fdf4;color:#27ae60;border-left:4px solid #27ae60;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px"></div>
        <button type="submit" id="t-btn" class="btn btn--primary btn--full">Transfer Funds</button>
      </form>
    </div>`;

  try {
    const res = await api.get('/accounts/my');
    const active = (res.data || []).filter(a => a.status === 'ACTIVE');
    const sel = document.getElementById('t-from');
    sel.innerHTML = active.length
      ? active.map(a => `<option value="${a.id}">${esc(a.account_number)} — ETB ${fmt(a.balance)}</option>`).join('')
      : '<option value="">No active accounts</option>';
  } catch {}

  document.getElementById('transfer-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('transfer-err');
    const okEl  = document.getElementById('transfer-ok');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    const btn = document.getElementById('t-btn');
    btn.disabled = true; btn.textContent = 'Processing…';
    try {
      const res = await api.post('/transactions/transfer', {
        fromAccountId: document.getElementById('t-from').value,
        toAccountId:   document.getElementById('t-to').value.trim(),
        amount:        parseFloat(document.getElementById('t-amount').value),
        description:   document.getElementById('t-desc').value.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      const tx = res.data?.transaction || {};
      okEl.textContent = `✅ Transfer of ETB ${fmt(tx.amount)} completed. Reference: ${tx.reference_number}`;
      okEl.style.display = 'block';
      document.getElementById('t-amount').value = '';
      document.getElementById('t-to').value = '';
    } catch (err) {
      errEl.textContent = '❌ ' + (err.message || 'Transfer failed.');
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Transfer Funds';
    }
  });
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function renderProfile(container, user) {
  container.innerHTML = `
    <h2 class="view-title">My Profile</h2>
    <div class="card" style="max-width:480px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
        <div style="width:60px;height:60px;border-radius:50%;background:#1a3c5e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">
          ${esc((user.email || 'U')[0].toUpperCase())}
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;color:#1a3c5e">${esc(user.email || '')}</div>
          <span class="badge badge--success">${esc(user.role_name || 'Customer')}</span>
        </div>
      </div>
      <dl style="display:grid;grid-template-columns:140px 1fr;gap:12px 16px;font-size:14px">
        <dt style="color:#6c757d;font-weight:600">Email</dt>
        <dd style="color:#1a1a2e">${esc(user.email || '—')}</dd>
        <dt style="color:#6c757d;font-weight:600">Role</dt>
        <dd style="color:#1a1a2e">${esc(user.role_name || '—')}</dd>
        <dt style="color:#6c757d;font-weight:600">Status</dt>
        <dd><span class="badge ${badgeClass(user.status)}">${esc(user.status || '—')}</span></dd>
        <dt style="color:#6c757d;font-weight:600">Last Login</dt>
        <dd style="color:#1a1a2e">${user.last_login_at ? new Date(user.last_login_at).toLocaleString('en-ET') : 'N/A'}</dd>
        <dt style="color:#6c757d;font-weight:600">Member Since</dt>
        <dd style="color:#1a1a2e">${user.created_at ? new Date(user.created_at).toLocaleDateString('en-ET') : 'N/A'}</dd>
      </dl>
      <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap">
        <a href="/change-password.html" class="btn btn--outline" style="color:#1a3c5e;border-color:#dee2e6">🔑 Change Password</a>
        <button class="btn btn--primary btn--sm" onclick="location.hash='otp'">📱 Verify Account</button>
      </div>
    </div>`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function stat(val, label, color) {
  return `<div class="card stat-card" style="border-left:4px solid ${color}">
    <div style="font-size:22px;font-weight:900;color:${color};margin-bottom:4px">${esc(String(val))}</div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6c757d;font-weight:600">${esc(label)}</div>
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
  return Number(n || 0).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function statusColor(s) {
  const m = { ACTIVE:'#27ae60', PENDING_ACTIVATION:'#f39c12', SUSPENDED:'#e74c3c', CLOSED:'#6c757d', POSTED:'#27ae60', REVERSED:'#9b59b6', PENDING:'#f39c12' };
  return m[s] || '#dee2e6';
}

function badgeClass(s) {
  const m = {
    ACTIVE:'badge--success', POSTED:'badge--success', APPROVED:'badge--success', ACCOUNT_CREATED:'badge--success',
    PENDING_ACTIVATION:'badge--warning', SUBMITTED:'badge--info', UNDER_REVIEW:'badge--info', PENDING:'badge--warning',
    SUSPENDED:'badge--danger', REJECTED:'badge--danger', FAILED:'badge--danger',
    CORRECTION_REQUIRED:'badge--warning', DRAFT:'badge--secondary', CLOSED:'badge--secondary',
    REVERSED:'badge--secondary', active:'badge--success', suspended:'badge--danger',
  };
  return m[s] || 'badge--secondary';
}
