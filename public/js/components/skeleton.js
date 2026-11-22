/**
 * skeleton.js — Skeleton placeholder HTML generators.
 * Used by views while data is loading.
 */

/**
 * Returns n skeleton card divs as an HTML string.
 * @param {number} n - number of skeleton cards
 * @returns {string}
 */
export function cardSkeletons(n = 4) {
  return Array.from({ length: n })
    .map(
      () => `<div class="card skeleton skeleton--card" aria-hidden="true"></div>`,
    )
    .join('\n');
}

/**
 * Returns n skeleton table rows with cols columns.
 * @param {number} n - number of rows
 * @param {number} cols - number of columns per row
 * @returns {string}
 */
export function tableRowSkeletons(n = 5, cols = 5) {
  const cells = Array.from({ length: cols })
    .map(() => `<td><div class="skeleton skeleton--text"></div></td>`)
    .join('');
  return Array.from({ length: n })
    .map(() => `<tr aria-hidden="true">${cells}</tr>`)
    .join('\n');
}

export default { cardSkeletons, tableRowSkeletons };
