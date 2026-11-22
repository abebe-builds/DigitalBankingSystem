/**
 * cashier.js — Cashier/Teller views.
 * Views: teller, transactions, summary
 */
import api from '../api.js';
import toast from '../components/toast.js';
import { cardSkeletons } from '../components/skeleton.js';
import { renderTransactionTable } from '../components/transactionTable.js';
import { showModal } from '../components/modal.js';

export async function render(container, view, user) {
  switch (view) {
    case 'transactions':
      await renderTransactions(container, user);
      break;
    case 'summary':
      await renderSummary(container, user);
      break;
    case 'teller':
    default:
      await renderTellerOps(container, user);
      break;
  }
}

// ─── TELLER OPS ───────────────────────────────────────────────────────────────
async function renderTellerOps(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Teller Operations</h2>
    <div class="stat-grid" id="stat-grid">
      ${cardSkeletons(4)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;">
      <!-- Deposit Form -->
      <div class="card">
        <h3>Deposit</h3>
        <form id="deposit-form" class="form-grid">
          <div class="form-group">
            <label for="dep-account">Account Number</label>
            <input type="text" id="dep-account" class="form-control" placeholder="13-digit account number" required />
          </div>
          <div class="form-group">
            <label for="dep-amount">Amount (ETB)</label>
            <input type="number" id="dep-amount" class="form-control" min="1" step="0.01" required />
          </div>
          <div class="form-group">
            <label for="dep-desc">Description</label>
            <input type="text" id="dep-desc" class="form-control" placeholder="Optional" />
          </div>
          <div id="dep-error" class="alert alert-error hidden"></div>
          <div class="form-group">
            <button type="submit" id="dep-btn" class="btn btn--success btn--full">Deposit</button>
          </div>
        </form>
      </div>

      <!-- Withdrawal Form -->
      <div class="card">
        <h3>Withdrawal</h3>
        <form id="withdrawal-form" class="form-grid">
          <div class="form-group">
            <label for="wd-account">Account Number</label>
            <input type="text" id="wd-account" class="form-control" placeholder="13-digit account number" required />
          </div>
          <div class="form-group">
            <label for="wd-amount">Amount (ETB)</label>
            <input type="number" id="wd-amount" class="form-control" min="1" step="0.01" required />
          </div>
          <div class="form-group">
            <label for="wd-desc">Description</label>
            <input type="text" id="wd-desc" class="form-control" placeholder="Optional" />
          </div>
          <div id="wd-error" class="alert alert-error hidden"></div>
          <div class="form-group">
            <button type="submit" id="wd-btn" class="btn btn--danger btn--full">Withdraw</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Load teller stats
  loadTellerStats();

  // Deposit form
  document.getElementById('deposit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleTellerTransaction('deposit', {
      accountId: document.getElementById('dep-account')?.value.trim(),
      amount: parseFloat(document.getElementById('dep-amount')?.value),
      description: document.getElementById('dep-desc')?.value.trim(),
    }, 'dep-btn', 'dep-error');
  });

  // Withdrawal form
  document.getElementById('withdrawal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleTellerTransaction('withdrawal', {
      accountId: document.getElementById('wd-account')?.value.trim(),
      amount: parseFloat(document.getElementById('wd-amount')?.value),
      description: document.getElementById('wd-desc')?.value.trim(),
    }, 'wd-btn', 'wd-error');
  });
}

async function handleTellerTransaction(type, payload, btnId, errId) {
  const btn = document.getElementById(btnId);
  const errEl = document.getElementById(errId);

  if (errEl) errEl.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    const res = await api.post(`/transactions/${type}`, {
      ...payload,
      idempotencyKey: crypto.randomUUID(),
    });
    const tx = res.transaction || res.data || {};

    // Show success toast
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} successful! ETB ${Number(tx.amount || payload.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    // Show receipt modal
    showModal({
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Receipt`,
      bodyHTML: `
        <dl class="details-list">
          <dt>Transaction ID</dt><dd>${escapeHtml(String(tx.id || '-'))}</dd>
          <dt>Type</dt><dd>${escapeHtml(type.toUpperCase())}</dd>
          <dt>Amount</dt><dd>ETB ${Number(tx.amount || payload.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
          <dt>Account</dt><dd>${escapeHtml(String(tx.account_id || payload.accountId || '-'))}</dd>
          <dt>Reference</dt><dd>${escapeHtml(String(tx.reference_number || tx.idempotency_key || '-'))}</dd>
          <dt>Date</dt><dd>${new Date().toLocaleString()}</dd>
          <dt>Status</dt><dd>${escapeHtml(String(tx.status || 'POSTED'))}</dd>
        </dl>
      `,
      buttons: [{ label: 'Close', value: null, variant: 'secondary' }],
    });

    // Reset form
    document.getElementById(btnId.replace('-btn', '-form'))?.reset();
    loadTellerStats();
  } catch (err) {
    const msg = err.message || `${type} failed`;
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    } else {
      toast.error(msg);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loadTellerStats() {
  const statGrid = document.getElementById('stat-grid');
  if (!statGrid) return;

  try {
    const res = await api.get('/reconciliation/teller-summary');
    const summary = res.summary || res.data || {};

    const deposits = Number(summary.total_deposits || 0);
    const withdrawals = Number(summary.total_withdrawals || 0);
    const count = Number(summary.transaction_count || 0);
    const net = deposits - withdrawals;

    statGrid.innerHTML = `
      ${statCard(`Today Deposits`, `ETB ${deposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'accent--success')}
      ${statCard(`Today Withdrawals`, `ETB ${withdrawals.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'accent--danger')}
      ${statCard('Transaction Count', count, 'accent--primary')}
      ${statCard('Net Cash', `ETB ${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, net >= 0 ? 'accent--info' : 'accent--danger')}
    `;
  } catch {
    statGrid.innerHTML = `
      ${statCard('Today Deposits', 'N/A', 'accent--success')}
      ${statCard('Today Withdrawals', 'N/A', 'accent--danger')}
      ${statCard('Transaction Count', 'N/A', 'accent--primary')}
      ${statCard('Net Cash', 'N/A', 'accent--info')}
    `;
  }
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
async function renderTransactions(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Transactions</h2>
    <div id="tx-container">
      <div class="card"><p>Loading…</p></div>
    </div>
  `;

  try {
    const res = await api.get('/transactions', { limit: 50 });
    const txs = res.transactions || res.data || [];
    renderTransactionTable(txs, document.getElementById('tx-container'));
  } catch (err) {
    document.getElementById('tx-container').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
async function renderSummary(container, user) {
  container.innerHTML = `
    <h2 class="view-title">Daily Summary</h2>
    <div id="summary-content">
      ${cardSkeletons(4)}
    </div>
  `;

  try {
    const res = await api.get('/reconciliation/teller-summary');
    const summary = res.summary || res.data || {};

    const rows = Object.entries(summary).map(([key, val]) => `
      <tr>
        <td>${escapeHtml(key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))}</td>
        <td>${escapeHtml(String(val))}</td>
      </tr>
    `).join('');

    document.getElementById('summary-content').innerHTML = `
      <div class="card">
        <h3>Teller Summary for Today</h3>
        <div class="table-container">
          <table class="table">
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('summary-content').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
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
