/**
 * transactionTable.js — Paginated transaction table with row-click details.
 */
import api from '../api.js';
import { showModal } from './modal.js';

const STATUS_BADGE = {
  POSTED: 'badge--active',
  PENDING: 'badge--pending',
  REVERSED: 'badge--suspended',
  FAILED: 'badge--closed',
};

/**
 * Renders a transaction table into the given container.
 * @param {Array} transactions
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {boolean} [opts.showPagination]
 * @param {Function} [opts.onPageChange]
 * @param {number} [opts.page]
 * @param {number} [opts.total]
 * @param {number} [opts.limit]
 * @param {boolean} [opts.showReversal] - show Reverse button for Operations role
 * @param {Function} [opts.onReverse] - callback when reversal is done
 */
export function renderTransactionTable(transactions, container, opts = {}) {
  if (!container) return;
  container.innerHTML = '';

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon" aria-hidden="true">📊</span>
        <p class="empty-state__message">No transactions found</p>
      </div>
    `;
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'table-container';

  const table = document.createElement('table');
  table.className = 'table';
  table.setAttribute('aria-label', 'Transactions');

  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Type</th>
        <th scope="col">Description</th>
        <th scope="col">Amount</th>
        <th scope="col">Status</th>
        ${opts.showReversal ? '<th scope="col">Actions</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${transactions.map((tx) => buildRow(tx, opts.showReversal)).join('')}
    </tbody>
  `;

  wrapper.appendChild(table);
  container.appendChild(wrapper);

  // Row click → fetch details and show modal
  table.querySelectorAll('tr[data-id]').forEach((row) => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', async (e) => {
      // Don't fire modal when clicking action buttons
      if (e.target.closest('[data-action]')) return;

      const id = row.getAttribute('data-id');
      try {
        const res = await api.get(`/transactions/${id}`);
        const tx = res.transaction || res.data || res;
        showModal({
          title: 'Transaction Details',
          bodyHTML: buildDetailsHTML(tx),
          buttons: [{ label: 'Close', value: null, variant: 'secondary' }],
        });
      } catch (err) {
        // Silently ignore
      }
    });
  });

  // Reversal button handlers
  if (opts.showReversal && typeof opts.onReverse === 'function') {
    table.querySelectorAll('[data-action="reverse"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        opts.onReverse(id);
      });
    });
  }

  // Pagination
  if (opts.showPagination && opts.total > opts.limit) {
    const pages = Math.ceil(opts.total / opts.limit);
    const currentPage = opts.page || 1;

    const pagination = document.createElement('div');
    pagination.className = 'pagination';
    pagination.setAttribute('aria-label', 'Pagination');

    for (let i = 1; i <= pages; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn--sm ${i === currentPage ? 'btn--primary' : 'btn--secondary'}`;
      btn.textContent = String(i);
      btn.setAttribute('aria-current', i === currentPage ? 'page' : 'false');
      if (i !== currentPage && typeof opts.onPageChange === 'function') {
        btn.addEventListener('click', () => opts.onPageChange(i));
      }
      pagination.appendChild(btn);
    }

    container.appendChild(pagination);
  }
}

function buildRow(tx, showReversal) {
  const date = tx.created_at
    ? new Date(tx.created_at).toLocaleDateString()
    : '-';
  const type = tx.transaction_type || tx.type || '-';
  const desc = tx.description || '-';
  const amount = Number(tx.amount || 0);
  const isCredit = type === 'DEPOSIT' || (type === 'TRANSFER' && amount > 0);
  const amountClass = isCredit ? 'td--amount-credit' : 'td--amount-debit';
  const amountStr = `${isCredit ? '+' : '-'}ETB ${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const status = tx.status || 'POSTED';
  const badgeClass = STATUS_BADGE[status] || 'badge--pending';

  const actionCell = showReversal && status === 'POSTED'
    ? `<td><button type="button" class="btn btn--danger btn--sm" data-action="reverse" data-id="${tx.id}">Reverse</button></td>`
    : showReversal ? '<td></td>' : '';

  return `
    <tr data-id="${tx.id}" tabindex="0" aria-label="Transaction ${tx.id}">
      <td>${escapeHtml(date)}</td>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(desc)}</td>
      <td class="${amountClass}">${escapeHtml(amountStr)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(status)}</span></td>
      ${actionCell}
    </tr>
  `;
}

function buildDetailsHTML(tx) {
  const rows = [
    ['ID', tx.id],
    ['Type', tx.transaction_type || tx.type],
    ['Amount', `ETB ${Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ['Status', tx.status],
    ['Description', tx.description],
    ['Reference', tx.reference_number || tx.idempotency_key || '-'],
    ['Date', tx.created_at ? new Date(tx.created_at).toLocaleString() : '-'],
    ['Account', tx.account_id || '-'],
  ];

  return `
    <dl class="details-list">
      ${rows.map(([label, val]) => `
        <dt>${escapeHtml(String(label))}</dt>
        <dd>${escapeHtml(String(val ?? '-'))}</dd>
      `).join('')}
    </dl>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export default renderTransactionTable;
