// =============================================================================
// Smart Grid — Example: Detachable Pagination Footer
// =============================================================================

import type { SmartGridAPI } from '@smart-grid/core';

export interface PaginationFooterOptions {
  readonly target: HTMLElement;
  readonly grid: SmartGridAPI;
  readonly mode?: 'embedded' | 'detached';
}

export function mountPaginationFooter(options: PaginationFooterOptions): () => void {
  const { target, grid, mode = 'embedded' } = options;

  const root = document.createElement('div');
  root.className = 'sg-pagination-footer';

  const left = document.createElement('div');
  left.className = 'sg-pagination-footer__left';
  const center = document.createElement('div');
  center.className = 'sg-pagination-footer__center';
  const right = document.createElement('div');
  right.className = 'sg-pagination-footer__right';

  const showLabel = document.createElement('span');
  showLabel.className = 'sg-pagination-footer__label';
  showLabel.textContent = 'Show';

  const pageSizeSelect = document.createElement('select');
  pageSizeSelect.className = 'sg-pagination-footer__select';
  [10, 25, 50, 100, 250, 500, 1000].forEach((size) => {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = String(size);
    pageSizeSelect.appendChild(option);
  });

  const firstButton = createTextButton('First');
  const prevButton = createTextButton('Previous');
  const nextButton = createTextButton('Next');
  const lastButton = createTextButton('Last');

  const pageLabel = document.createElement('span');
  pageLabel.className = 'sg-pagination-footer__label';
  pageLabel.textContent = 'Page';

  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.className = 'sg-pagination-footer__page-input';
  pageInput.min = '1';

  const pageCount = document.createElement('span');
  pageCount.className = 'sg-pagination-footer__label';

  const itemsText = document.createElement('span');
  itemsText.className = 'sg-pagination-footer__items';

  left.appendChild(showLabel);
  left.appendChild(pageSizeSelect);

  center.appendChild(firstButton);
  center.appendChild(prevButton);
  center.appendChild(pageLabel);
  center.appendChild(pageInput);
  center.appendChild(pageCount);
  center.appendChild(nextButton);
  center.appendChild(lastButton);

  right.appendChild(itemsText);

  root.appendChild(left);
  root.appendChild(center);
  root.appendChild(right);

  if (mode === 'detached') {
    root.classList.add('sg-pagination-footer--detached');
    document.body.appendChild(root);
  } else {
    target.appendChild(root);
  }

  function createTextButton(text: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sg-pagination-footer__link-btn';
    button.textContent = text;
    return button;
  }

  function currentPagination() {
    const { pagination } = grid.getState();
    const pageSize = pagination.pageSize > 0 ? pagination.pageSize : pagination.totalRows || 1;
    const totalPages = Math.max(1, Math.ceil(pagination.totalRows / pageSize));
    const page = Math.min(pagination.page, totalPages - 1);

    return {
      page,
      pageSize,
      totalRows: pagination.totalRows,
      totalPages,
      enabled: pagination.pageSize > 0,
    };
  }

  function applyPage(value: number): void {
    const { totalPages, enabled, pageSize } = currentPagination();
    if (!enabled) return;
    const next = Math.max(0, Math.min(Math.floor(value), totalPages - 1));
    grid.setPagination(next, pageSize);
  }

  function render(): void {
    const { page, pageSize, totalRows, totalPages, enabled } = currentPagination();

    pageSizeSelect.value = String(pageSize);
    pageInput.value = String(page + 1);
    pageCount.textContent = `of ${totalPages.toLocaleString()}`;
    itemsText.textContent = `${totalRows.toLocaleString()} items`;

    const atStart = page <= 0;
    const atEnd = page >= totalPages - 1;
    firstButton.disabled = !enabled || atStart;
    prevButton.disabled = !enabled || atStart;
    nextButton.disabled = !enabled || atEnd;
    lastButton.disabled = !enabled || atEnd;
  }

  pageSizeSelect.addEventListener('change', () => {
    const parsed = Number.parseInt(pageSizeSelect.value, 10);
    const nextSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
    grid.setPagination(0, nextSize);
  });

  firstButton.addEventListener('click', () => applyPage(0));
  prevButton.addEventListener('click', () => {
    const { page } = currentPagination();
    applyPage(page - 1);
  });
  nextButton.addEventListener('click', () => {
    const { page } = currentPagination();
    applyPage(page + 1);
  });
  lastButton.addEventListener('click', () => {
    const { totalPages } = currentPagination();
    applyPage(totalPages - 1);
  });

  pageInput.addEventListener('change', () => {
    const raw = Number.parseInt(pageInput.value, 10);
    if (!Number.isFinite(raw)) {
      render();
      return;
    }

    applyPage(raw - 1);
  });

  const unsubscribe = grid.getStore().subscribe(() => render());
  render();

  return () => {
    unsubscribe();
    root.remove();
  };
}
