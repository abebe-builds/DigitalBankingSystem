/**
 * auditor.js — Auditor views.
 * Views: transactions (default), accounts (read-only), audit
 */
import api from '../api.js';
import { cardSkeletons } from '../components/skeleton.js';
import { renderTransactionTable } from '../components/transactionTable.js';
import { renderAccountCards } from '../components/accountCard.js';

export async function render(container, view, user) {
  switch (view) {
    case 'accounts':
      await renderAccounts(container, user);
      break;
    case 'audit':
      renderAudit(container);
      break;
    case 'transactions':
    default:
      await renderTransactions(container, user);
      break;
  }
}

// ─── TRANSACTIONS (read-only) ─────────────────────────────────────────────────
async function renderTransactions(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Transactions</h2>
    <div class="stat-grid" id="stat-grid">
      ${cardSkeletons(4)}
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="form-group" style="margin:0;display:flex;gap:8px;align-items:flex-end;">
        <div style="flex:1;">
          <label for="tx-account-filter">Filter by Account ID</label>
          <input type="text" id="tx-account-filter" class="form-control" placeholder="Account ID (optional)" />
        </div>
        <button type="button" id="tx-filter-btn" class="btn btn--secondary">Filter</button>
      </div>
    </div>
    <div id="tx-container"></div>
  `;

  async function loadTransactions(accountId) {
    const txContainer = document.getElementById('tx-container');
    txContainer.innerHTML = `<div class="card"><p>Loading…</p></div>`;

    const params = {};
    if (accountId) params.accountId = accountId;

    const res = await api.get('/transactions', params);
    const txs = res.transactions || res.data || [];
    renderTransactionTable(txs, txContainer);
    return txs;
  }

  // Load stats
  try {
    const [txRes, accRes] = await Promise.allSettled([
      api.get('/transactions'),
      api.get('/accounts'),
    ]);

    const txs = txRes.status === 'fulfilled' ? (txRes.value.transactions || txRes.value.data || []) : [];
    const accs = accRes.status === 'fulfilled' ? (accRes.value.accounts || accRes.value.data || []) : [];
    const reversed = txs.filter((t) => t.status === 'REVERSED').length;

    // Try reconciliation for balance check
    let balanced = 'N/A';
    try {
      const reconRes = await api.post('/reconciliation/run');
      const results = reconRes.results || reconRes.data || [];
      const discrepancies = results.filter((r) => !r.balanced).length;
      balanced = discrepancies === 0 ? '✓ Balanced' : `⚠ ${discrepancies} issues`;
    } catch {
      balanced = 'N/A';
    }

    document.getElementById('stat-grid').innerHTML = `
      ${statCard('Total Transactions', txs.length, 'accent--primary')}
      ${statCard('Reversed', reversed, 'accent--danger')}
      ${statCard('Total Accounts', accs.length, 'accent--info')}
      ${statCard('Balances', balanced, 'accent--success')}
    `;

    await loadTransactions('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    return;
  }

  document.getElementById('tx-filter-btn').addEventListener('click', async () => {
    const accountId = document.getElementById('tx-account-filter')?.value.trim();
    try {
      await loadTransactions(accountId);
    } catch (err) {
      document.getElementById('tx-container').innerHTML =
        `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

// ─── ACCOUNTS (read-only) ─────────────────────────────────────────────────────
async function renderAccounts(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Accounts</h2>
    <div id="accounts-list" class="card-grid">
      ${cardSkeletons(4)}
    </div>
  `;

  try {
    const res = await api.get('/accounts');
    const accounts = res.accounts || res.data || [];
    renderAccountCards(accounts, document.getElementById('accounts-list'), user.role_name);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

// ─── AUDIT LOG (placeholder) ──────────────────────────────────────────────────
function renderAudit(container) {
  container.innerHTML = `
    <h2 class="view-title">Audit Log</h2>
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;padding:24px;">
        <span style="font-size:2rem;" aria-hidden="true">ℹ️</span>
        <div>
          <strong>Audit log endpoint coming in Phase 6</strong>
          <p class="text-muted" style="margin:4px 0 0;">The full audit trail will be available in the next release.</p>
        </div>
      </div>
    </div>
  `;
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
