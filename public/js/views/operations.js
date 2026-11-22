/**
 * operations.js — Operations/Finance views.
 * Views: reconciliation (default), transactions, accounts
 */
import api from '../api.js';
import toast from '../components/toast.js';
import { cardSkeletons } from '../components/skeleton.js';
import { renderTransactionTable } from '../components/transactionTable.js';
import { renderAccountCards } from '../components/accountCard.js';
import { confirmModal, showModal } from '../components/modal.js';

export async function render(container, view, user) {
  switch (view) {
    case 'transactions':
      await renderTransactions(container, user);
      break;
    case 'accounts':
      await renderAccounts(container, user);
      break;
    case 'reconciliation':
    default:
      await renderReconciliation(container, user);
      break;
  }
}

// ─── RECONCILIATION ───────────────────────────────────────────────────────────
async function renderReconciliation(container, user) {
  let lastResult = null;

  container.innerHTML = `
    <h2 class="view-title">Reconciliation</h2>
    <div class="stat-grid" id="stat-grid">
      ${cardSkeletons(4)}
    </div>
    <div class="card" style="margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3>Run Reconciliation</h3>
          <p class="text-muted">Check ledger vs stored balances for all accounts.</p>
        </div>
        <button type="button" id="run-recon-btn" class="btn btn--primary">▶ Run Reconciliation</button>
      </div>
    </div>
    <div id="recon-results"></div>
    <div class="card" style="margin-top:24px;">
      <h3>Teller Summary</h3>
      <div id="teller-summary-content"><p class="text-muted">Loading…</p></div>
    </div>
  `;

  // Load teller summary
  loadTellerSummary();

  document.getElementById('run-recon-btn').addEventListener('click', async () => {
    const btn = document.getElementById('run-recon-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Running…';

    try {
      const res = await api.post('/reconciliation/run');
      lastResult = res.results || res.data || [];
      renderReconResults(lastResult, document.getElementById('recon-results'));
      updateReconStats(lastResult);
      toast.success('Reconciliation complete');
    } catch (err) {
      toast.error(err.message || 'Reconciliation failed');
      document.getElementById('recon-results').innerHTML =
        `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '▶ Run Reconciliation';
    }
  });
}

function renderReconResults(results, container) {
  if (!container) return;

  if (!results || results.length === 0) {
    container.innerHTML = `<div class="card"><p class="text-muted">No results yet. Run reconciliation to see results.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h3>Reconciliation Results</h3>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Ledger Balance</th>
              <th>Stored Balance</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((r) => `
              <tr>
                <td>${escapeHtml(String(r.account_id || r.id || '-'))}</td>
                <td>ETB ${Number(r.ledger_balance || r.calculated || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>ETB ${Number(r.stored_balance || r.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>${r.balanced || r.match ? '<span style="color:var(--color-success)">✓ Match</span>' : '<span style="color:var(--color-danger)">✗ Mismatch</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function updateReconStats(results) {
  const statGrid = document.getElementById('stat-grid');
  if (!statGrid) return;

  const total = results.length;
  const discrepancies = results.filter((r) => !(r.balanced || r.match)).length;
  const now = new Date().toLocaleTimeString();

  statGrid.innerHTML = `
    ${statCard('Total Accounts Checked', total, 'accent--primary')}
    ${statCard('Discrepancies', discrepancies, 'accent--danger')}
    ${statCard('Last Run', now, 'accent--success')}
    ${statCard('Status', discrepancies === 0 ? '✓ Clean' : '⚠ Issues', discrepancies === 0 ? 'accent--success' : 'accent--danger')}
  `;
}

async function loadTellerSummary() {
  const el = document.getElementById('teller-summary-content');
  if (!el) return;

  try {
    const res = await api.get('/reconciliation/teller-summary');
    const summary = res.summary || res.data || {};

    const rows = Object.entries(summary).map(([key, val]) => `
      <tr>
        <td>${escapeHtml(key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))}</td>
        <td>${escapeHtml(String(val))}</td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p class="text-muted">${escapeHtml(err.message)}</p>`;
  }
}

// ─── TRANSACTIONS (with reversal) ─────────────────────────────────────────────
async function renderTransactions(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Transactions</h2>
    <div id="tx-container"></div>
  `;

  async function loadTransactions() {
    const txContainer = document.getElementById('tx-container');
    txContainer.innerHTML = `<div class="card"><p>Loading…</p></div>`;

    const res = await api.get('/transactions');
    const txs = res.transactions || res.data || [];

    renderTransactionTable(txs, txContainer, {
      showReversal: true,
      onReverse: async (transactionId) => {
        const confirmed = await confirmModal(
          'Reverse Transaction',
          'Are you sure you want to reverse this transaction?',
        );
        if (!confirmed) return;

        // Prompt for reason
        let reason = '';
        await showModal({
          title: 'Reason for Reversal',
          bodyHTML: `
            <div class="form-group">
              <label for="reversal-reason">Reason</label>
              <textarea id="reversal-reason" class="form-control" rows="3" placeholder="Required reason for reversal"></textarea>
            </div>
          `,
          closeOnBackdrop: false,
          buttons: [
            { label: 'Cancel', value: '__cancel__', variant: 'secondary' },
            { label: 'Reverse', value: '__confirm__', variant: 'danger' },
          ],
        }).then(async (val) => {
          if (val !== '__confirm__') return;
          reason = document.getElementById('reversal-reason')?.value.trim();
          if (!reason) {
            toast.error('A reason is required for reversal');
            return;
          }

          try {
            await api.post('/transactions/reverse', { transactionId, reason });
            toast.success('Transaction reversed');
            loadTransactions();
          } catch (err) {
            toast.error(err.message || 'Reversal failed');
          }
        });
      },
    });
  }

  try {
    await loadTransactions();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
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
