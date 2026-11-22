/**
 * applicationCard.js — Application cards with role-aware action buttons.
 */
import api from '../api.js';
import toast from './toast.js';
import { showModal, confirmModal } from './modal.js';

/** Badge class mapping by application status */
function statusBadge(status) {
  const map = {
    DRAFT: 'badge--draft',
    SUBMITTED: 'badge--submitted',
    UNDER_REVIEW: 'badge--under-review',
    CORRECTION_REQUIRED: 'badge--correction-required',
    APPROVED: 'badge--approved',
    REJECTED: 'badge--rejected',
    ACCOUNT_CREATED: 'badge--account-created',
  };
  return map[status] || 'badge--pending';
}

/**
 * Renders application cards into a container.
 * @param {Array} apps
 * @param {HTMLElement} container
 * @param {string} role - current user role_name
 * @param {Function} onRefresh - callback to reload data
 */
export function renderApplicationCards(apps, container, role, onRefresh) {
  if (!container) return;
  container.innerHTML = '';

  if (!apps || apps.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon" aria-hidden="true">📋</span>
        <p class="empty-state__message">No applications found</p>
      </div>
    `;
    return;
  }

  apps.forEach((app) => {
    const card = document.createElement('div');
    card.className = 'card application-card';

    const badge = statusBadge(app.status);

    card.innerHTML = `
      <div class="application-card__header">
        <span class="application-card__ref">${escapeHtml(app.reference_number || app.id || '')}</span>
        <span class="badge ${badge}">${escapeHtml(app.status || '')}</span>
      </div>
      <div class="application-card__details">
        <div><strong>Type:</strong> ${escapeHtml(app.account_type || '-')}</div>
        <div><strong>Applicant:</strong> ${escapeHtml(`${app.first_name || ''} ${app.last_name || ''}`.trim() || '-')}</div>
        <div><strong>Submitted:</strong> ${app.created_at ? new Date(app.created_at).toLocaleDateString() : '-'}</div>
      </div>
      <div class="application-card__actions" id="app-actions-${app.id}">
        ${buildActionButtons(app, role)}
      </div>
    `;

    attachActionHandlers(card, app, role, onRefresh);
    container.appendChild(card);
  });
}

function buildActionButtons(app, role) {
  const btns = [];

  // View details button for all roles
  btns.push(`<button type="button" class="btn btn--outline btn--sm" data-action="view-details" data-id="${app.id}">View Details</button>`);

  if (role === 'Customer') {
    if (app.status === 'DRAFT' || app.status === 'CORRECTION_REQUIRED') {
      btns.push(`<button type="button" class="btn btn--secondary btn--sm" data-action="edit" data-id="${app.id}">Edit</button>`);
      btns.push(`<button type="button" class="btn btn--primary btn--sm" data-action="submit" data-id="${app.id}">Submit</button>`);
    }
  }

  if (role === 'Account Opening Employee') {
    if (app.status === 'SUBMITTED') {
      btns.push(`<button type="button" class="btn btn--primary btn--sm" data-action="review" data-id="${app.id}">Start Review</button>`);
    }
    if (app.status === 'UNDER_REVIEW') {
      btns.push(`<button type="button" class="btn btn--warning btn--sm" data-action="request-correction" data-id="${app.id}">Request Correction</button>`);
    }
  }

  if (role === 'KYC/Compliance Officer') {
    if (app.status === 'SUBMITTED') {
      btns.push(`<button type="button" class="btn btn--primary btn--sm" data-action="review" data-id="${app.id}">Start Review</button>`);
    }
    if (app.status === 'UNDER_REVIEW') {
      btns.push(`<button type="button" class="btn btn--warning btn--sm" data-action="request-correction" data-id="${app.id}">Request Correction</button>`);
    }
  }

  if (role === 'Manager/Authorized Approver') {
    if (app.status === 'UNDER_REVIEW') {
      btns.push(`<button type="button" class="btn btn--success btn--sm" data-action="approve" data-id="${app.id}">Approve</button>`);
      btns.push(`<button type="button" class="btn btn--danger btn--sm" data-action="reject" data-id="${app.id}">Reject</button>`);
    }
    if (app.status === 'APPROVED') {
      btns.push(`<button type="button" class="btn btn--primary btn--sm" data-action="create-account" data-id="${app.id}">Create Account</button>`);
    }
  }

  return btns.join(' ');
}

function attachActionHandlers(card, app, role, onRefresh) {
  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!action || !id) return;

    btn.disabled = true;

    try {
      if (action === 'view-details') {
        await showApplicationDetails(app);
        btn.disabled = false;
        return;
      }

      if (action === 'edit') {
        await openEditModal(app, onRefresh);
        btn.disabled = false;
        return;
      }

      if (action === 'submit') {
        const confirmed = await confirmModal('Submit Application', 'Are you sure you want to submit this application?');
        if (!confirmed) { btn.disabled = false; return; }
        await api.post(`/applications/${id}/submit`);
        toast.success('Application submitted');
      } else if (action === 'review') {
        await api.post(`/applications/${id}/review`);
        toast.success('Application moved to Under Review');
      } else if (action === 'request-correction') {
        const instructions = await promptForCorrection();
        if (!instructions) { btn.disabled = false; return; }
        await api.post(`/applications/${id}/request-correction`, { correction_instructions: instructions });
        toast.success('Correction requested');
      } else if (action === 'approve') {
        const confirmed = await confirmModal('Approve Application', 'Approve this application?');
        if (!confirmed) { btn.disabled = false; return; }
        await api.post(`/applications/${id}/approve`);
        toast.success('Application approved');
      } else if (action === 'reject') {
        const confirmed = await confirmModal('Reject Application', 'Reject this application?');
        if (!confirmed) { btn.disabled = false; return; }
        await api.post(`/applications/${id}/reject`);
        toast.success('Application rejected');
      } else if (action === 'create-account') {
        const confirmed = await confirmModal('Create Account', 'Create bank account for this approved application?');
        if (!confirmed) { btn.disabled = false; return; }
        await api.post(`/applications/${id}/create-account`);
        toast.success('Account created successfully');
      }

      if (typeof onRefresh === 'function') onRefresh();
    } catch (err) {
      toast.error(err.message || `Action failed: ${action}`);
      btn.disabled = false;
    }
  });
}

async function promptForCorrection() {
  return new Promise((resolve) => {
    showModal({
      title: 'Request Correction',
      bodyHTML: `
        <div class="form-group">
          <label for="correction-instructions">Correction Instructions</label>
          <textarea
            id="correction-instructions"
            class="form-control"
            rows="4"
            placeholder="Describe what needs to be corrected..."
          ></textarea>
        </div>
      `,
      closeOnBackdrop: false,
      buttons: [
        { label: 'Cancel', value: '__cancel__', variant: 'secondary' },
        { label: 'Send', value: '__send__', variant: 'primary' },
      ],
    }).then((val) => {
      if (val === '__send__') {
        const textarea = document.getElementById('correction-instructions');
        resolve(textarea ? textarea.value.trim() : null);
      } else {
        resolve(null);
      }
    });
  });
}

async function openEditModal(app, onRefresh) {
  showModal({
    title: 'Edit Application',
    bodyHTML: `
      <form id="edit-app-form" class="form-grid">
        <div class="form-group">
          <label for="edit-first-name">First Name</label>
          <input type="text" id="edit-first-name" class="form-control" value="${escapeHtml(app.first_name || '')}" />
        </div>
        <div class="form-group">
          <label for="edit-last-name">Last Name</label>
          <input type="text" id="edit-last-name" class="form-control" value="${escapeHtml(app.last_name || '')}" />
        </div>
        <div class="form-group">
          <label for="edit-phone">Phone</label>
          <input type="text" id="edit-phone" class="form-control" value="${escapeHtml(app.phone || '')}" />
        </div>
        <div class="form-group">
          <label for="edit-national-id">National ID</label>
          <input type="text" id="edit-national-id" class="form-control" value="${escapeHtml(app.national_id || '')}" />
        </div>
      </form>
    `,
    buttons: [
      { label: 'Cancel', value: '__cancel__', variant: 'secondary' },
      { label: 'Save', value: '__save__', variant: 'primary' },
    ],
  }).then(async (val) => {
    if (val === '__save__') {
      const updates = {
        first_name: document.getElementById('edit-first-name')?.value.trim(),
        last_name: document.getElementById('edit-last-name')?.value.trim(),
        phone: document.getElementById('edit-phone')?.value.trim(),
        national_id: document.getElementById('edit-national-id')?.value.trim(),
      };
      try {
        await api.put(`/applications/${app.id}`, updates);
        toast.success('Application updated');
        if (typeof onRefresh === 'function') onRefresh();
      } catch (err) {
        toast.error(err.message || 'Failed to update application');
      }
    }
  });
}

async function showApplicationDetails(app) {
  // Fetch full application details
  try {
    const res = await api.get(`/applications/${app.id}`);
    const fullApp = res.application || res.data || app;
    
    showModal({
      title: `Application Details - ${fullApp.reference_number || fullApp.id}`,
      bodyHTML: `
        <div style="max-height:70vh;overflow-y:auto">
          <!-- Status Badge -->
          <div style="margin-bottom:20px;padding:12px;background:#f8f9fa;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;color:#1a3c5e">Status</div>
              <div style="font-size:13px;color:#6c757d;margin-top:2px">Submitted: ${fullApp.submitted_at ? new Date(fullApp.submitted_at).toLocaleString() : 'Not yet submitted'}</div>
            </div>
            <span class="badge ${statusBadge(fullApp.status)}">${escapeHtml(fullApp.status || '')}</span>
          </div>

          <!-- Personal Information -->
          <div style="margin-bottom:24px">
            <h4 style="font-size:15px;font-weight:700;color:#1a3c5e;margin-bottom:12px;border-bottom:2px solid #dee2e6;padding-bottom:8px">📋 Personal Information</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">First Name</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.first_name || 'Not provided')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Last Name</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.last_name || 'Not provided')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Date of Birth</div>
                <div style="font-weight:600;color:#1a3c5e">${fullApp.date_of_birth ? new Date(fullApp.date_of_birth).toLocaleDateString() : 'Not provided'}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Gender</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.gender || 'Not provided')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">National ID</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.national_id || 'Not provided')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Nationality</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.nationality || 'Not provided')}</div>
              </div>
            </div>
          </div>

          <!-- Contact Information -->
          <div style="margin-bottom:24px">
            <h4 style="font-size:15px;font-weight:700;color:#1a3c5e;margin-bottom:12px;border-bottom:2px solid #dee2e6;padding-bottom:8px">📞 Contact Information</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Phone</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.phone || 'Not provided')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Email</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.email || 'Not provided')}</div>
              </div>
            </div>
          </div>

          <!-- Address Information -->
          <div style="margin-bottom:24px">
            <h4 style="font-size:15px;font-weight:700;color:#1a3c5e;margin-bottom:12px;border-bottom:2px solid #dee2e6;padding-bottom:8px">🏠 Address Information</h4>
            <div style="display:grid;grid-template-columns:1fr;gap:12px">
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Address Line 1</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.address_line1 || 'Not provided')}</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
                <div>
                  <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">City</div>
                  <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.city || 'Not provided')}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">State/Region</div>
                  <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.state || 'Not provided')}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Postal Code</div>
                  <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.postal_code || 'Not provided')}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Account Information -->
          <div style="margin-bottom:24px">
            <h4 style="font-size:15px;font-weight:700;color:#1a3c5e;margin-bottom:12px;border-bottom:2px solid #dee2e6;padding-bottom:8px">💰 Account Information</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Account Type</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.account_type || 'Not provided')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Initial Deposit</div>
                <div style="font-weight:600;color:#1a3c5e">${fullApp.initial_deposit_amount ? 'ETB ' + Number(fullApp.initial_deposit_amount).toLocaleString() : 'Not provided'}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Currency</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.currency || 'ETB')}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px">Employment Status</div>
                <div style="font-weight:600;color:#1a3c5e">${escapeHtml(fullApp.employment_status || 'Not provided')}</div>
              </div>
            </div>
          </div>

          <!-- Completeness Check -->
          ${generateCompletenessCheck(fullApp)}

          <!-- Correction Instructions (if any) -->
          ${fullApp.correction_instructions ? `
          <div style="background:#fff8e1;border-left:4px solid #f39c12;border-radius:8px;padding:14px;margin-top:16px">
            <div style="font-size:13px;font-weight:600;color:#856404;margin-bottom:6px">⚠️ Correction Required</div>
            <div style="font-size:13px;color:#856404;line-height:1.6">${escapeHtml(fullApp.correction_instructions)}</div>
          </div>` : ''}

          <!-- Rejection Reason (if any) -->
          ${fullApp.rejection_reason ? `
          <div style="background:#fdf2f2;border-left:4px solid #e74c3c;border-radius:8px;padding:14px;margin-top:16px">
            <div style="font-size:13px;font-weight:600;color:#c62828;margin-bottom:6px">❌ Rejection Reason</div>
            <div style="font-size:13px;color:#c62828;line-height:1.6">${escapeHtml(fullApp.rejection_reason)}</div>
          </div>` : ''}
        </div>
      `,
      buttons: [{ label: 'Close', value: null, variant: 'secondary' }],
    });
  } catch (err) {
    toast.error('Failed to load application details: ' + err.message);
  }
}

function generateCompletenessCheck(app) {
  const required = [
    { label: 'First Name', value: app.first_name },
    { label: 'Last Name', value: app.last_name },
    { label: 'Date of Birth', value: app.date_of_birth },
    { label: 'National ID', value: app.national_id },
    { label: 'Phone', value: app.phone },
    { label: 'Address', value: app.address_line1 },
    { label: 'City', value: app.city },
    { label: 'Account Type', value: app.account_type },
  ];

  const missing = required.filter(field => !field.value || field.value.trim() === '');
  const complete = missing.length === 0;

  return `
    <div style="background:${complete ? '#e8f5e9' : '#fff3e0'};border-left:4px solid ${complete ? '#27ae60' : '#ff9800'};border-radius:8px;padding:14px;margin-top:16px">
      <div style="font-size:13px;font-weight:600;color:${complete ? '#1b5e20' : '#e65100'};margin-bottom:8px">
        ${complete ? '✅ Application Complete' : '⚠️ Missing Information'}
      </div>
      ${complete ? 
        '<div style="font-size:13px;color:#1b5e20">All required fields are filled. Application is ready for review.</div>' :
        `<div style="font-size:13px;color:#e65100;line-height:1.6">Missing fields: ${missing.map(f => f.label).join(', ')}</div>`
      }
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export default renderApplicationCards;
