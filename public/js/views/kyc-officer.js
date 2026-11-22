/**
 * kyc-officer.js — KYC/Compliance Officer views.
 * Views: applications, kyc
 */
import api from '../api.js';
import toast from '../components/toast.js';
import { cardSkeletons } from '../components/skeleton.js';
import { renderApplicationCards } from '../components/applicationCard.js';

export async function render(container, view, user) {
  switch (view) {
    case 'kyc':
      await renderKycReview(container, user);
      break;
    case 'applications':
    default:
      await renderApplications(container, user);
      break;
  }
}

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────
async function renderApplications(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Applications</h2>
    <div class="stat-grid" id="stat-grid">
      ${cardSkeletons(4)}
    </div>
    <div id="apps-list" class="card-grid">
      ${cardSkeletons(3)}
    </div>
  `;

  try {
    const res = await api.get('/applications');
    const apps = res.applications || res.data || [];

    const underReview = apps.filter((a) => a.status === 'UNDER_REVIEW').length;
    const submitted = apps.filter((a) => a.status === 'SUBMITTED').length;
    const approved = apps.filter((a) => a.status === 'APPROVED').length;
    const accountCreated = apps.filter((a) => a.status === 'ACCOUNT_CREATED').length;

    document.getElementById('stat-grid').innerHTML = `
      ${statCard('Under Review', underReview, 'accent--warning')}
      ${statCard('Submitted', submitted, 'accent--info')}
      ${statCard('Approved', approved, 'accent--success')}
      ${statCard('Completed', accountCreated, 'accent--primary')}
    `;

    const listEl = document.getElementById('apps-list');
    renderApplicationCards(apps, listEl, user.role_name, () => renderApplications(container, user));
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

// ─── KYC REVIEW ───────────────────────────────────────────────────────────────
async function renderKycReview(container, user) {
  container.innerHTML = `
    <h2 class="view-title">KYC Verification</h2>
    <p class="text-muted">Comprehensive identity verification and compliance checks</p>
    <div id="kyc-apps-list" class="card-grid">
      ${cardSkeletons(3)}
    </div>
    <div id="kyc-verification-panel" style="margin-top:24px;"></div>
  `;

  try {
    const res = await api.get('/applications');
    const apps = (res.applications || res.data || []).filter((a) =>
      a.status === 'UNDER_REVIEW' || a.status === 'SUBMITTED',
    );

    const listEl = document.getElementById('kyc-apps-list');
    if (!apps.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon" aria-hidden="true">🔍</span>
          <p class="empty-state__message">No applications pending KYC review</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = apps
      .map(
        (app) => `
        <div class="card" style="cursor:pointer;" data-app-id="${app.id}">
          <strong>${escapeHtml(app.reference_number || app.id)}</strong>
          <span class="badge badge--pending" style="margin-left:8px;">${escapeHtml(app.status)}</span>
          <div class="text-muted" style="margin-top:4px;">
            ${escapeHtml(`${app.first_name || ''} ${app.last_name || ''}`.trim())}<br/>
            <small>National ID: ${escapeHtml(app.national_id || 'N/A')}</small>
          </div>
        </div>
      `,
      )
      .join('');

    listEl.querySelectorAll('[data-app-id]').forEach((card) => {
      card.addEventListener('click', async () => {
        const appId = card.getAttribute('data-app-id');
        await loadKycVerificationPanel(appId);
      });
    });
  } catch (err) {
    document.getElementById('kyc-apps-list').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

async function loadKycVerificationPanel(appId) {
  const panel = document.getElementById('kyc-verification-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="card"><p>Loading verification panel…</p></div>`;

  try {
    // Fetch application and documents
    const [appRes, docsRes] = await Promise.all([
      api.get(`/applications/${appId}`),
      api.get(`/applications/${appId}/documents`)
    ]);
    
    const app = appRes.application || appRes.data || {};
    const docs = docsRes.documents || docsRes.data || [];

    panel.innerHTML = `
      <div class="card" style="max-width:1200px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div>
            <h3 style="margin:0">KYC Verification: ${escapeHtml(app.reference_number || appId)}</h3>
            <div style="font-size:14px;color:#6c757d;margin-top:4px">
              Applicant: ${escapeHtml(`${app.first_name || ''} ${app.last_name || ''}`.trim())}
            </div>
          </div>
          <span class="badge badge--pending" style="font-size:14px">${escapeHtml(app.status || '')}</span>
        </div>

        <!-- KYC Verification Checklist -->
        <div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
          <h4 style="font-size:16px;font-weight:700;color:#1a3c5e;margin-bottom:16px">🔍 Verification Checklist</h4>
          <div id="kyc-checklist-${appId}">
            ${renderKycChecklist(app, docs)}
          </div>
        </div>

        <!-- Document Verification Section -->
        <div style="margin-bottom:24px">
          <h4 style="font-size:16px;font-weight:700;color:#1a3c5e;margin-bottom:16px;border-bottom:2px solid #dee2e6;padding-bottom:8px">
            📄 Document Verification
          </h4>
          ${docs.length > 0 ? renderDocumentCards(docs, appId) : '<p class="text-muted">No documents uploaded</p>'}
        </div>

        <!-- Applicant Information Summary -->
        <div style="margin-bottom:24px">
          <h4 style="font-size:16px;font-weight:700;color:#1a3c5e;margin-bottom:16px;border-bottom:2px solid #dee2e6;padding-bottom:8px">
            👤 Applicant Information
          </h4>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
            <div>
              <div style="font-size:12px;color:#6c757d;text-transform:uppercase">Full Name</div>
              <div style="font-weight:600">${escapeHtml(`${app.first_name || ''} ${app.last_name || ''}`.trim())}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6c757d;text-transform:uppercase">National ID</div>
              <div style="font-weight:600;font-family:monospace">${escapeHtml(app.national_id || 'N/A')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6c757d;text-transform:uppercase">Date of Birth</div>
              <div style="font-weight:600">${app.date_of_birth ? new Date(app.date_of_birth).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6c757d;text-transform:uppercase">Phone</div>
              <div style="font-weight:600">${escapeHtml(app.phone || 'N/A')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6c757d;text-transform:uppercase">Address</div>
              <div style="font-weight:600">${escapeHtml(app.address_line1 || 'N/A')}, ${escapeHtml(app.city || '')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6c757d;text-transform:uppercase">Account Type</div>
              <div style="font-weight:600">${escapeHtml(app.account_type || 'N/A')}</div>
            </div>
          </div>
        </div>

        <!-- Verification Notes -->
        <div style="margin-bottom:24px">
          <h4 style="font-size:16px;font-weight:700;color:#1a3c5e;margin-bottom:12px">📝 KYC Officer Notes</h4>
          <textarea id="kyc-notes-${appId}" class="form-control" rows="4" 
            placeholder="Enter your verification findings, concerns, or additional checks performed..."
            style="width:100%;padding:12px;border:2px solid #dee2e6;border-radius:8px;font-size:14px"></textarea>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:12px;justify-content:flex-end;border-top:2px solid #dee2e6;padding-top:20px">
          <button class="btn btn--outline" onclick="location.hash='kyc'">Cancel</button>
          <button id="kyc-request-correction-${appId}" class="btn btn--warning">Request Correction</button>
          <button id="kyc-mark-verified-${appId}" class="btn btn--success">Mark as KYC Verified</button>
        </div>
      </div>
    `;

    // Attach event listeners
    document.getElementById(`kyc-mark-verified-${appId}`)?.addEventListener('click', async () => {
      const notes = document.getElementById(`kyc-notes-${appId}`)?.value.trim();
      await markAsVerified(appId, notes);
    });

    document.getElementById(`kyc-request-correction-${appId}`)?.addEventListener('click', async () => {
      await requestKycCorrection(appId);
    });

    // Attach checkbox handlers
    attachChecklistHandlers(appId);

  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderKycChecklist(app, docs) {
  const checks = [
    {
      id: 'doc_uploaded',
      label: 'Identity document uploaded',
      status: docs.length > 0,
      category: 'documents'
    },
    {
      id: 'id_authentic',
      label: 'National ID appears authentic (no signs of tampering)',
      status: false,
      category: 'identity'
    },
    {
      id: 'id_not_expired',
      label: 'ID document is not expired',
      status: false,
      category: 'identity'
    },
    {
      id: 'photo_matches',
      label: 'Photo on ID matches applicant profile',
      status: false,
      category: 'identity'
    },
    {
      id: 'id_verified_db',
      label: 'ID number verified against government database',
      status: false,
      category: 'identity',
      note: 'In production: Check National ID Management Agency database'
    },
    {
      id: 'address_verified',
      label: 'Address verified with utility bill or rental agreement',
      status: false,
      category: 'address'
    },
    {
      id: 'aml_check',
      label: 'AML screening completed (no matches found)',
      status: false,
      category: 'compliance',
      note: 'Check Anti-Money Laundering databases'
    },
    {
      id: 'sanctions_check',
      label: 'Sanctions list screening (UN, OFAC, EU)',
      status: false,
      category: 'compliance',
      note: 'Check international sanctions lists'
    },
    {
      id: 'pep_check',
      label: 'PEP (Politically Exposed Person) screening',
      status: false,
      category: 'compliance',
      note: 'Check if applicant is government official or politically exposed'
    },
    {
      id: 'watchlist_check',
      label: 'Criminal watchlist screening',
      status: false,
      category: 'compliance',
      note: 'Check domestic and international watchlists'
    },
    {
      id: 'risk_assessment',
      label: 'Customer risk level assessed',
      status: false,
      category: 'risk',
      note: 'Low/Medium/High risk classification'
    }
  ];

  const categories = {
    documents: '📄 Documents',
    identity: '🆔 Identity Verification',
    address: '🏠 Address Verification',
    compliance: '⚖️ Compliance Screening',
    risk: '⚠️ Risk Assessment'
  };

  let html = '';
  Object.keys(categories).forEach(cat => {
    const catChecks = checks.filter(c => c.category === cat);
    if (catChecks.length === 0) return;

    html += `
      <div style="margin-bottom:20px">
        <div style="font-weight:700;color:#1a3c5e;margin-bottom:10px;font-size:14px">${categories[cat]}</div>
        ${catChecks.map(check => `
          <div style="background:white;border:2px solid #dee2e6;border-radius:8px;padding:12px;margin-bottom:8px">
            <label style="display:flex;align-items:flex-start;cursor:pointer;gap:10px">
              <input type="checkbox" 
                id="check-${check.id}" 
                ${check.status ? 'checked' : ''}
                ${check.status && check.id === 'doc_uploaded' ? 'disabled' : ''}
                style="margin-top:3px;width:18px;height:18px;accent-color:#27ae60"/>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px;color:#1a3c5e">${check.label}</div>
                ${check.note ? `<div style="font-size:11px;color:#6c757d;margin-top:4px;font-style:italic">${check.note}</div>` : ''}
              </div>
            </label>
          </div>
        `).join('')}
      </div>
    `;
  });

  return html;
}

function renderDocumentCards(docs, appId) {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${docs.map(doc => `
        <div class="card" style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div style="font-weight:700;color:#1a3c5e;font-size:14px">${escapeHtml(doc.document_type || 'Document')}</div>
            <span class="badge badge--${doc.verified ? 'active' : 'pending'}">${doc.verified ? 'Verified' : 'Pending'}</span>
          </div>
          <div style="font-size:12px;color:#6c757d;margin-bottom:8px">
            ${escapeHtml(doc.document_name || doc.file_name || '-')}
          </div>
          <div style="font-size:11px;color:#adb5bd;margin-bottom:12px">
            Uploaded: ${doc.created_at ? new Date(doc.created_at).toLocaleString() : '-'}
          </div>
          ${!doc.verified ? `
            <button type="button" 
              class="btn btn--success btn--sm" 
              style="width:100%" 
              data-verify-doc="${doc.id}" 
              data-app-id="${appId}">
              ✓ Verify Document
            </button>
          ` : '<div style="text-align:center;color:#27ae60;font-weight:600">✓ Verified</div>'}
        </div>
      `).join('')}
    </div>
  `;
}

function attachChecklistHandlers(appId) {
  // Store checklist state in localStorage
  const checkboxes = document.querySelectorAll(`[id^="check-"]`);
  checkboxes.forEach(cb => {
    const key = `kyc-${appId}-${cb.id}`;
    const saved = localStorage.getItem(key);
    if (saved === 'true') cb.checked = true;

    cb.addEventListener('change', () => {
      localStorage.setItem(key, cb.checked.toString());
    });
  });

  // Verify document buttons
  document.querySelectorAll('[data-verify-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.getAttribute('data-verify-doc');
      const aid = btn.getAttribute('data-app-id');
      btn.disabled = true;
      try {
        await api.patch(`/applications/${aid}/documents/${docId}/verify`);
        toast.success('Document verified');
        await loadKycVerificationPanel(aid);
      } catch (err) {
        toast.error(err.message || 'Verification failed');
        btn.disabled = false;
      }
    });
  });
}

async function markAsVerified(appId, notes) {
  try {
    const confirmed = confirm('Mark this application as KYC Verified?\n\nThis confirms all identity and compliance checks are complete.');
    if (!confirmed) return;

    // Call the verify-kyc endpoint
    await api.post(`/applications/${appId}/verify-kyc`, { notes });
    
    toast.success('Application marked as KYC Verified - Ready for manager approval');
    
    // Clear checklist data
    const checkboxes = document.querySelectorAll(`[id^="check-"]`);
    checkboxes.forEach(cb => {
      const key = `kyc-${appId}-${cb.id}`;
      localStorage.removeItem(key);
    });
    
    location.hash = 'applications';
  } catch (err) {
    toast.error(err.message || 'Failed to mark as verified');
  }
}

async function requestKycCorrection(appId) {
  const instructions = prompt('Enter correction instructions for the applicant:');
  if (!instructions || !instructions.trim()) return;

  try {
    await api.post(`/applications/${appId}/request-correction`, { 
      correction_instructions: instructions 
    });
    toast.success('Correction requested');
    location.hash = 'kyc';
  } catch (err) {
    toast.error(err.message || 'Failed to request correction');
  }
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
