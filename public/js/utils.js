/**
 * utils.js — shared utility functions for the Digital Banking System UI.
 * Pure functions; no DOM side effects at module load time.
 */

// ─── CURRENCY ─────────────────────────────────────────────────────────────────

/**
 * Format a numeric amount as an ETB currency string.
 * @param {number|string} amount
 * @param {boolean} [showSign=false] - prepend + for positive values
 * @returns {string} e.g. "ETB 1,500.00"
 */
export function formatCurrency(amount, showSign = false) {
  const num = Number(amount);
  if (Number.isNaN(num)) return 'ETB —';
  const formatted = new Intl.NumberFormat('en-ET', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  const sign = showSign && num > 0 ? '+' : num < 0 ? '-' : '';
  return `${sign}ETB ${formatted}`;
}

// ─── DATES ────────────────────────────────────────────────────────────────────

/**
 * Format an ISO date string or Date to a readable local date-time.
 * @param {string|Date|null} value
 * @returns {string} e.g. "17 Oct 2026, 14:35"
 */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format an ISO date string to a short date only.
 * @param {string|Date|null} value
 * @returns {string} e.g. "17 Oct 2026"
 */
export function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Return a relative time string like "2 hours ago".
 * @param {string|Date} value
 * @returns {string}
 */
export function timeAgo(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return formatDate(value);
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(value);
}

// ─── STATUS FORMATTING ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  // Application statuses
  DRAFT:               { label: 'Draft',             cls: 'badge--gray'   },
  SUBMITTED:           { label: 'Submitted',          cls: 'badge--blue'   },
  UNDER_REVIEW:        { label: 'Under Review',       cls: 'badge--purple' },
  CORRECTION_REQUIRED: { label: 'Correction Required',cls: 'badge--amber'  },
  APPROVED:            { label: 'Approved',           cls: 'badge--green'  },
  REJECTED:            { label: 'Rejected',           cls: 'badge--red'    },
  ACCOUNT_CREATED:     { label: 'Account Created',    cls: 'badge--teal'   },
  // Account statuses
  ACTIVE:              { label: 'Active',             cls: 'badge--green'  },
  PENDING_ACTIVATION:  { label: 'Pending Activation', cls: 'badge--amber'  },
  SUSPENDED:           { label: 'Suspended',          cls: 'badge--orange' },
  CLOSED:              { label: 'Closed',             cls: 'badge--gray'   },
  // Transaction statuses
  PENDING:             { label: 'Pending',            cls: 'badge--amber'  },
  POSTED:              { label: 'Posted',             cls: 'badge--green'  },
  REVERSED:            { label: 'Reversed',           cls: 'badge--purple' },
  FAILED:              { label: 'Failed',             cls: 'badge--red'    },
  // User statuses
  active:              { label: 'Active',             cls: 'badge--green'  },
  suspended:           { label: 'Suspended',          cls: 'badge--orange' },
  locked:              { label: 'Locked',             cls: 'badge--red'    },
  closed:              { label: 'Closed',             cls: 'badge--gray'   },
};

/**
 * Return the display label for a status code.
 * @param {string} status
 * @returns {string}
 */
export function formatStatus(status) {
  return STATUS_CONFIG[status]?.label ?? status;
}

/**
 * Return an HTML badge element string for a status.
 * @param {string} status
 * @returns {string} HTML string
 */
export function statusBadge(status) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'badge--gray' };
  return `<span class="badge ${cfg.cls}">${escapeHtml(cfg.label)}</span>`;
}

// ─── TRANSACTION TYPE ─────────────────────────────────────────────────────────

const TXN_TYPE_LABELS = {
  DEPOSIT:        'Deposit',
  WITHDRAWAL:     'Withdrawal',
  TRANSFER_DEBIT: 'Transfer Out',
  TRANSFER_CREDIT:'Transfer In',
  REVERSAL:       'Reversal',
  FEE:            'Fee',
};

export function formatTxnType(type) {
  return TXN_TYPE_LABELS[type] ?? type;
}

// ─── DOM HELPERS ──────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/**
 * Build an HTML table from an array of objects.
 * @param {object[]} rows
 * @param {Array<{key: string, label: string, format?: function}>} columns
 * @param {string} [emptyMessage]
 * @returns {string} HTML string
 */
export function buildTable(rows, columns, emptyMessage = 'No records found.') {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state__icon">📋</div>
      <p class="empty-state__text">${escapeHtml(emptyMessage)}</p>
    </div>`;
  }
  const headers = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
  const bodyRows = rows.map(row => {
    const cells = columns.map(c => {
      const raw = row[c.key];
      const val = c.format ? c.format(raw, row) : escapeHtml(raw ?? '—');
      return `<td>${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr>${headers}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

/**
 * Build a simple pagination bar.
 * @param {number} page - current 1-based page
 * @param {boolean} hasMore - whether there are more pages
 * @param {function} onPage - callback(newPage)
 * @returns {HTMLElement}
 */
export function buildPagination(page, hasMore, onPage) {
  const div = document.createElement('div');
  div.className = 'pagination';

  const prev = document.createElement('button');
  prev.className = 'btn btn--outline btn--sm';
  prev.textContent = '← Previous';
  prev.disabled = page <= 1;
  prev.addEventListener('click', () => onPage(page - 1));

  const label = document.createElement('span');
  label.className = 'pagination__label';
  label.textContent = `Page ${page}`;

  const next = document.createElement('button');
  next.className = 'btn btn--outline btn--sm';
  next.textContent = 'Next →';
  next.disabled = !hasMore;
  next.addEventListener('click', () => onPage(page + 1));

  div.append(prev, label, next);
  return div;
}

/**
 * Set a button into loading/idle state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 * @param {string} [idleLabel]
 */
export function setButtonLoading(btn, loading, idleLabel = btn?.dataset?.label ?? btn?.textContent) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.label = btn.textContent;
    btn.innerHTML = '<span class="spinner spinner--sm"></span> Loading…';
  } else {
    btn.textContent = idleLabel;
  }
}

/**
 * Create a skeleton placeholder element.
 * @param {'line'|'card'|'circle'} type
 * @param {object} [opts]
 * @returns {HTMLElement}
 */
export function skeleton(type = 'line', opts = {}) {
  const el = document.createElement('div');
  el.className = `skeleton skeleton--${type}`;
  if (opts.width)  el.style.width  = opts.width;
  if (opts.height) el.style.height = opts.height;
  return el;
}
