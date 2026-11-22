/**
 * account-opening.js — Account Opening Employee views.
 * Views: applications, documents
 */
import api from '../api.js';
import toast from '../components/toast.js';
import { cardSkeletons } from '../components/skeleton.js';
import { renderApplicationCards } from '../components/applicationCard.js';
import { showModal } from '../components/modal.js';

export async function render(container, view, user) {
  switch (view) {
    case 'documents':
      await renderDocuments(container, user);
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

    // Compute status counts
    const total = apps.length;
    const pendingReview = apps.filter((a) => a.status === 'SUBMITTED').length;
    const correctionsSent = apps.filter((a) => a.status === 'CORRECTION_REQUIRED').length;
    const underReview = apps.filter((a) => a.status === 'UNDER_REVIEW').length;

    document.getElementById('stat-grid').innerHTML = `
      ${statCard('Total Applications', total, 'accent--primary')}
      ${statCard('Pending Review', pendingReview, 'accent--warning')}
      ${statCard('Corrections Sent', correctionsSent, 'accent--info')}
      ${statCard('Under Review', underReview, 'accent--success')}
    `;

    const listEl = document.getElementById('apps-list');
    renderApplicationCards(apps, listEl, user.role_name, () => renderApplications(container, user));
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
async function renderDocuments(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Documents</h2>
    <p class="text-muted">Select an application to view its documents.</p>
    <div id="apps-select-list" class="card-grid">
      ${cardSkeletons(3)}
    </div>
    <div id="doc-view" style="margin-top:24px;"></div>
  `;

  try {
    const res = await api.get('/applications');
    const apps = (res.applications || res.data || []).filter((a) =>
      ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED', 'REJECTED'].includes(a.status),
    );

    const listEl = document.getElementById('apps-select-list');
    if (!apps.length) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-state__icon">📄</span><p>No applications with documents</p></div>`;
      return;
    }

    listEl.innerHTML = apps
      .map(
        (app) => `
        <div class="card" style="cursor:pointer;" data-app-id="${app.id}">
          <strong>${escapeHtml(app.reference_number || app.id)}</strong>
          <span class="badge badge--pending" style="margin-left:8px;">${escapeHtml(app.status)}</span>
          <div class="text-muted" style="margin-top:4px;">${escapeHtml(`${app.first_name || ''} ${app.last_name || ''}`.trim())}</div>
        </div>
      `,
      )
      .join('');

    listEl.querySelectorAll('[data-app-id]').forEach((card) => {
      card.addEventListener('click', async () => {
        const appId = card.getAttribute('data-app-id');
        await loadDocuments(appId);
      });
    });
  } catch (err) {
    document.getElementById('apps-select-list').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDocuments(appId) {
  const docView = document.getElementById('doc-view');
  if (!docView) return;

  docView.innerHTML = `<div class="card"><p>Loading documents…</p></div>`;

  try {
    const res = await api.get(`/applications/${appId}/documents`);
    const docs = res.documents || res.data || [];

    if (!docs.length) {
      docView.innerHTML = `<div class="card"><p class="text-muted">No documents uploaded for this application.</p></div>`;
      return;
    }

    docView.innerHTML = `
      <div class="card">
        <h3>Documents</h3>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Uploaded</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${docs
                .map(
                  (doc) => `
                <tr>
                  <td>${escapeHtml(doc.document_name || doc.file_name || '-')}</td>
                  <td>${escapeHtml(doc.document_type || '-')}</td>
                  <td>${doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}</td>
                  <td><span class="badge badge--${doc.verified ? 'active' : 'pending'}">${doc.verified ? 'Verified' : 'Pending'}</span></td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    docView.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
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
