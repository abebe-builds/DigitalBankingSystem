/**
 * modal.js — Promise-based modal dialogs.
 * showModal() — generic modal with configurable buttons.
 * confirmModal() — shorthand yes/no confirm.
 */

/**
 * Show a modal dialog.
 * @param {{title: string, bodyHTML: string, buttons: Array<{label:string,value:any,variant?:string}>}} opts
 * @returns {Promise<any>} resolves with button.value when clicked
 */
export function showModal({ title, bodyHTML, buttons = [], closeOnBackdrop = true }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root') || document.body;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', title);

    const modal = document.createElement('div');
    modal.className = 'modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    header.innerHTML = `
      <h2 class="modal__title">${escapeHtml(title)}</h2>
      <button type="button" class="modal__close" aria-label="Close dialog">✕</button>
    `;

    const body = document.createElement('div');
    body.className = 'modal__body';
    body.innerHTML = bodyHTML;

    const footer = document.createElement('div');
    footer.className = 'modal__footer';

    buttons.forEach((btn) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn--${btn.variant || 'secondary'}`;
      button.textContent = btn.label;
      button.addEventListener('click', () => {
        cleanup();
        resolve(btn.value);
      });
      footer.appendChild(button);
    });

    modal.appendChild(header);
    modal.appendChild(body);
    if (buttons.length > 0) modal.appendChild(footer);

    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    // Focus modal for accessibility
    requestAnimationFrame(() => {
      backdrop.classList.add('modal-backdrop--visible');
      const firstBtn = footer.querySelector('button');
      if (firstBtn) firstBtn.focus();
    });

    function cleanup() {
      backdrop.classList.remove('modal-backdrop--visible');
      setTimeout(() => {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }, 200);
    }

    // Close button in header
    header.querySelector('.modal__close').addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    // Backdrop click to close (for non-confirm modals)
    if (closeOnBackdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          cleanup();
          resolve(null);
        }
      });
    }

    // Escape key to close
    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeydown);
        cleanup();
        resolve(null);
      }
    };
    document.addEventListener('keydown', onKeydown);
  });
}

/**
 * Confirm dialog — resolves true (Confirm) or false (Cancel).
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export async function confirmModal(title, message) {
  const result = await showModal({
    title,
    bodyHTML: `<p>${escapeHtml(message)}</p>`,
    closeOnBackdrop: false,
    buttons: [
      { label: 'Cancel', value: false, variant: 'secondary' },
      { label: 'Confirm', value: true, variant: 'primary' },
    ],
  });
  return result === true;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export default { showModal, confirmModal };
